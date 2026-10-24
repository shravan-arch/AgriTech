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

    const url = new URL('https://api.open-meteo.com/v1/forecast');
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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const fetchFn = options.fetchFn || fetch;

    try {
      const response = await fetchFn(url.toString(), {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'AgriTech-Platform/2.0',
        },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Open-Meteo returned status ${response.status}`);
      }

      const data = await response.json();
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
        farmId: farm._id,
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

      // Persist weather snapshot in MongoDB Atlas for historical charts
      if (options.persist !== false && store?.saveWeatherSnapshot) {
        try {
          await store.saveWeatherSnapshot(farm.ownerId, farm._id, {
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
      clearTimeout(timeout);

      // Attempt fallback to cached weather snapshot from database
      if (store?.getLatestWeatherSnapshot) {
        try {
          const cached = await store.getLatestWeatherSnapshot(farm.ownerId, farm._id);
          if (cached) {
            return {
              connected: true,
              stale: true,
              staleReason:
                err.name === 'AbortError'
                  ? 'Live weather request timed out; showing cached observations.'
                  : `Live weather unreachable (${err.message}); showing cached observations.`,
              farmId: farm._id,
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
