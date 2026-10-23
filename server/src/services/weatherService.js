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

  async getFarmWeather(farm) {
    if (!farm) {
      return { connected: false, message: 'Farm not found.' };
    }

    const lat = farm.location?.latitude;
    const lon = farm.location?.longitude;

    if (lat === undefined || lon === undefined || lat === null || lon === null) {
      return {
        connected: false,
        message: 'Farm geographical coordinates are not configured. Edit farm settings to provide latitude and longitude for genuine local weather.',
      };
    }

    const numericLat = Number(lat);
    const numericLon = Number(lon);

    if (isNaN(numericLat) || isNaN(numericLon) || numericLat < -90 || numericLat > 90 || numericLon < -180 || numericLon > 180) {
      return {
        connected: false,
        message: 'Farm geographical coordinates are invalid. Please check latitude (-90 to 90) and longitude (-180 to 180).',
      };
    }

    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', numericLat.toFixed(4));
    url.searchParams.set('longitude', numericLon.toFixed(4));
    url.searchParams.set('current', 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m');
    url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum');
    url.searchParams.set('timezone', 'auto');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AgriTech-Platform/1.0',
        },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return {
          connected: false,
          status: response.status,
          message: `Weather service responded with status ${response.status}.`,
        };
      }

      const data = await response.json();

      const current = data.current || {};
      const conditionText = this.getConditionText(current.weather_code);

      const forecastDays = [];
      if (data.daily && Array.isArray(data.daily.time)) {
        for (let i = 0; i < Math.min(data.daily.time.length, 5); i++) {
          forecastDays.push({
            date: data.daily.time[i],
            maxTemp: data.daily.temperature_2m_max?.[i],
            minTemp: data.daily.temperature_2m_min?.[i],
            precipitationSum: data.daily.precipitation_sum?.[i],
            weatherCode: data.daily.weather_code?.[i],
            condition: this.getConditionText(data.daily.weather_code?.[i]),
          });
        }
      }

      return {
        connected: true,
        farmId: farm._id,
        farmName: farm.name,
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
          precipitation: current.precipitation,
          windSpeed: current.wind_speed_10m,
          weatherCode: current.weather_code,
          condition: conditionText,
          observedAt: current.time,
        },
        forecast: forecastDays,
        updatedAt: new Date().toISOString(),
        source: 'Open-Meteo Meteorological Model (WMO Station Network)',
      };
    } catch (err) {
      clearTimeout(timeout);
      return {
        connected: false,
        message: err.name === 'AbortError'
          ? 'Live weather request timed out.'
          : 'Unable to reach weather service.',
      };
    }
  },
};

export default weatherService;
