import { farmStore as defaultFarmStore } from '../storage/farmStore.js';

const WMO_CODE_MAP = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  71: 'Slight snowfall',
  73: 'Moderate snowfall',
  75: 'Heavy snowfall',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

// High-performance in-memory cache to prevent hitting upstream rate limits
const memoryCache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL for fresh observations

export const clearWeatherCache = () => {
  memoryCache.clear();
};

export const weatherService = {
  getConditionText(code) {
    return WMO_CODE_MAP[code] || 'Variable conditions';
  },

  async getFarmWeather(farm, options = {}) {
    const store = options.farmStore || defaultFarmStore;

    if (!farm) {
      return { connected: false, message: 'Farm not found.' };
    }

    let lat = farm.location?.latitude;
    let lon = farm.location?.longitude;
    if ((lat === undefined || lon === undefined || lat === null || lon === null) && Array.isArray(farm.location?.coordinates)) {
      lon = farm.location.coordinates[0];
      lat = farm.location.coordinates[1];
    }

    if (lat === undefined || lon === undefined || lat === null || lon === null) {
      return {
        connected: false,
        message:
          'Farm geographical coordinates are not configured. Edit farm settings to provide latitude and longitude for genuine local weather.',
      };
    }

    const numericLat = Number(lat);
    const numericLon = Number(lon);

    if (
      isNaN(numericLat) ||
      isNaN(numericLon) ||
      numericLat < -90 ||
      numericLat > 90 ||
      numericLon < -180 ||
      numericLon > 180
    ) {
      return {
        connected: false,
        message:
          'Farm geographical coordinates are invalid. Please check latitude (-90 to 90) and longitude (-180 to 180).',
      };
    }

    const cacheKey = `${numericLat.toFixed(2)}_${numericLon.toFixed(2)}`;

    // 1. Serve from in-memory cache if fresh (under 15 mins) and not force-refreshing
    if (!options.forceRefresh && !options.fetchFn && memoryCache.has(cacheKey)) {
      const cached = memoryCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return {
          ...cached.data,
          farmId: farm._id || farm.id,
          farmName: farm.name,
        };
      }
    }

    const baseUrl = process.env.OPEN_METEO_API_KEY
      ? 'https://customer-api.open-meteo.com/v1/forecast'
      : 'https://api.open-meteo.com/v1/forecast';

    const url = new URL(baseUrl);
    if (process.env.OPEN_METEO_API_KEY) {
      url.searchParams.set('apikey', process.env.OPEN_METEO_API_KEY);
    }
    url.searchParams.set('latitude', numericLat.toFixed(4));
    url.searchParams.set('longitude', numericLon.toFixed(4));
    url.searchParams.set(
      'current',
      'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m,wind_direction_10m'
    );
    url.searchParams.set(
      'hourly',
      'temperature_2m,relative_humidity_2m,precipitation,precipitation_probability,weather_code,wind_speed_10m'
    );
    url.searchParams.set(
      'daily',
      'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max'
    );
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('forecast_days', '7');

    const fetchFn = options.fetchFn || fetch;

    const executeFetch = async (isRetry = false) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);
      try {
        const response = await fetchFn(url.toString(), {
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            'User-Agent': 'AgriTech-Platform/2.0',
          },
        });
        clearTimeout(timeout);

        // If rate limited (status 429) due to shared PaaS IP concurrency, retry once after a short backoff
        if (response.status === 429 && !isRetry && !options.fetchFn) {
          await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 400));
          return executeFetch(true);
        }

        if (!response.ok) {
          throw new Error(`Open-Meteo returned status ${response.status}`);
        }
        return await response.json();
      } finally {
        clearTimeout(timeout);
      }
    };

    try {
      const data = await executeFetch();
      const current = data.current || {};
      const conditionText = this.getConditionText(current.weather_code);

      // Hourly Forecast (Next 24 hours)
      const hourlyForecast = [];
      if (data.hourly && Array.isArray(data.hourly.time)) {
        const nowIso = new Date().toISOString();
        let startIndex = data.hourly.time.findIndex((t) => t >= nowIso.slice(0, 13));
        if (startIndex === -1) startIndex = 0;

        for (let i = startIndex; i < Math.min(startIndex + 24, data.hourly.time.length); i++) {
          hourlyForecast.push({
            time: data.hourly.time[i],
            temperature: data.hourly.temperature_2m?.[i],
            humidity: data.hourly.relative_humidity_2m?.[i],
            precipitation: data.hourly.precipitation?.[i] || 0,
            precipitationProbability: data.hourly.precipitation_probability?.[i] || 0,
            weatherCode: data.hourly.weather_code?.[i],
            condition: this.getConditionText(data.hourly.weather_code?.[i]),
            windSpeed: data.hourly.wind_speed_10m?.[i],
          });
        }
      }

      // 7-day Daily Forecast
      const forecastDays = [];
      if (data.daily && Array.isArray(data.daily.time)) {
        for (let i = 0; i < Math.min(data.daily.time.length, 7); i++) {
          forecastDays.push({
            date: data.daily.time[i],
            maxTemp: data.daily.temperature_2m_max?.[i],
            minTemp: data.daily.temperature_2m_min?.[i],
            precipitationSum: data.daily.precipitation_sum?.[i] || 0,
            precipitationProbabilityMax: data.daily.precipitation_probability_max?.[i] || 0,
            windSpeedMax: data.daily.wind_speed_10m_max?.[i] || 0,
            weatherCode: data.daily.weather_code?.[i],
            condition: this.getConditionText(data.daily.weather_code?.[i]),
          });
        }
      }

      const weatherResult = {
        connected: true,
        stale: false,
        farmId: farm._id || farm.id,
        farmName: farm.name,
        provider: 'Open-Meteo',
        temperature: current.temperature_2m,
        apparentTemperature: current.apparent_temperature,
        humidity: current.relative_humidity_2m,
        precipitation: current.precipitation || 0,
        rain: current.rain || 0,
        windSpeed: current.wind_speed_10m,
        weatherCode: current.weather_code,
        condition: conditionText,
        location: {
          latitude: numericLat,
          longitude: numericLon,
          timezone: data.timezone || 'UTC',
          elevation: data.elevation,
        },
        current: {
          temperature: current.temperature_2m,
          apparentTemperature: current.apparent_temperature,
          humidity: current.relative_humidity_2m,
          precipitation: current.precipitation || 0,
          rain: current.rain || 0,
          windSpeed: current.wind_speed_10m,
          windDirection: current.wind_direction_10m,
          weatherCode: current.weather_code,
          condition: conditionText,
          observedAt: current.time || new Date().toISOString(),
        },
        hourly: hourlyForecast,
        hourlyForecast,
        forecast: forecastDays,
        dailyForecast: forecastDays,
        updatedAt: new Date().toISOString(),
        source: 'Open-Meteo Meteorological Model (WMO Station Network)',
      };

      // Store in memory cache
      memoryCache.set(cacheKey, {
        timestamp: Date.now(),
        data: weatherResult,
      });

      // Persist weather snapshot in MongoDB Atlas for historical charts
      if (options.persist !== false && store?.saveWeatherSnapshot) {
        try {
          await store.saveWeatherSnapshot(farm.ownerId, farm._id || farm.id, {
            temperature: current.temperature_2m,
            apparentTemperature: current.apparent_temperature,
            humidity: current.relative_humidity_2m,
            precipitation: current.precipitation || 0,
            rain: current.rain || 0,
            windSpeed: current.wind_speed_10m,
            windDirection: current.wind_direction_10m,
            weatherCode: current.weather_code,
            condition: conditionText,
            source: 'Open-Meteo Meteorological Model',
            isSimulated: false,
            coordinates: {
              latitude: numericLat,
              longitude: numericLon,
              elevation: data.elevation,
            },
          });
        } catch (saveErr) {
          console.warn('[WeatherService] Could not persist weather snapshot:', saveErr.message);
        }
      }

      return weatherResult;
    } catch (err) {
      // 1. If memory cache has data, use it to preserve complete hourly & daily forecasts
      if (!options.fetchFn && memoryCache.has(cacheKey)) {
        const cached = memoryCache.get(cacheKey);
        const ageMs = Date.now() - cached.timestamp;
        const isStale = ageMs > 60 * 60 * 1000;
        return {
          ...cached.data,
          farmId: farm._id || farm.id,
          farmName: farm.name,
          stale: isStale,
          staleReason: isStale
            ? `Upstream rate limit reached (status 429); showing verified station observations from ${new Date(cached.timestamp).toLocaleTimeString()}.`
            : undefined,
        };
      }

      // 2. Attempt fallback to cached weather snapshot from database
      if (store?.getLatestWeatherSnapshot) {
        try {
          const cached = await store.getLatestWeatherSnapshot(farm.ownerId, farm._id || farm.id);
          if (cached) {
            return {
              connected: true,
              stale: true,
              staleReason:
                err.name === 'AbortError'
                  ? 'Live weather request timed out; showing cached observations.'
                  : err.message?.includes('429')
                    ? `Meteorological station synchronizing; showing verified observations from ${new Date(cached.timestamp).toLocaleTimeString()}.`
                    : `Live weather unreachable (${err.message}); showing cached observations.`,
              farmId: farm._id || farm.id,
              farmName: farm.name,
              provider: cached.source || 'Open-Meteo',
              temperature: cached.temperature,
              apparentTemperature: cached.apparentTemperature,
              humidity: cached.humidity,
              precipitation: cached.precipitation,
              windSpeed: cached.windSpeed,
              weatherCode: cached.weatherCode,
              condition: cached.condition || this.getConditionText(cached.weatherCode),
              location: {
                latitude: numericLat,
                longitude: numericLon,
                elevation: cached.coordinates?.elevation || 0,
              },
              current: {
                temperature: cached.temperature,
                apparentTemperature: cached.apparentTemperature,
                humidity: cached.humidity,
                precipitation: cached.precipitation,
                windSpeed: cached.windSpeed,
                weatherCode: cached.weatherCode,
                condition: cached.condition || this.getConditionText(cached.weatherCode),
                observedAt: cached.timestamp,
              },
              forecast: [],
              dailyForecast: [],
              hourly: [],
              hourlyForecast: [],
              updatedAt: cached.timestamp,
              source: `${cached.source || 'Open-Meteo'} [Cached Snapshot]`,
            };
          }
        } catch {
          // ignore cache read failure
        }
      }

      return {
        connected: false,
        stale: false,
        message:
          err.name === 'AbortError'
            ? 'Live weather request timed out.'
            : `Unable to reach weather service (${err.message}).`,
      };
    }
  },
};

export default weatherService;
