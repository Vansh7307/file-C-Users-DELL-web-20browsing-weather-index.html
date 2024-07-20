const cityInput = document.getElementById('city-input');
const searchBtn = document.getElementById('search-btn');
const cityName = document.getElementById('city-name');
const weatherDesc = document.getElementById('weather-desc');
const temp = document.getElementById('temp');
const humidity = document.getElementById('humidity');
const windSpeed = document.getElementById('wind-speed');

const apiKey = '929573d4f9cd2cf581b99af64ee069e8'; // Replace with your actual API key

searchBtn.addEventListener('click', () => {
    const city = cityInput.value;
    fetchWeatherData(city);
});

async function fetchWeatherData(city) {
    const apiUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`;

    try {
        const response = await fetch(apiUrl);
        const data = await response.json();

        cityName.textContent = data.name;
        weatherDesc.textContent = data.weather[0].description;
        temp.textContent = `Temperature: ${data.main.temp}°C`;
        humidity.textContent = `Humidity: ${data.main.humidity}%`;
        windSpeed.textContent = `Wind Speed: ${data.wind.speed} m/s`;
    } catch (error) {
        console.error('Error fetching weather data:', error);
        // Handle errors gracefully (e.g., display an error message)
    }
}