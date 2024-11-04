let API_KEY = localStorage.getItem('tmdb_api_key');
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const DEFAULT_POSTER = 'https://via.placeholder.com/500x750?text=No+Poster';

let currentPage = 1;
let currentSection = 'home';
let isLoading = false;

const mainContent = document.getElementById('main-content');

// Navigation
document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = e.target.getAttribute('data-page');
        navigateTo(page);
    });
});

function navigateTo(page) {
    if (page === currentSection) return;
    currentPage = 1;
    currentSection = page;
    mainContent.innerHTML = '';
    isLoading = false;
    loadContent();
}

// Content loading
async function loadContent() {
    if (isLoading || !API_KEY) return;
    isLoading = true;

    if (currentSection === 'home') {
        try {
            const [trending, topMovies, topSeries, upcoming] = await Promise.all([
                fetch(`${BASE_URL}/trending/all/day?api_key=${API_KEY}`).then(r => r.json()),
                fetch(`${BASE_URL}/movie/top_rated?api_key=${API_KEY}`).then(r => r.json()),
                fetch(`${BASE_URL}/tv/top_rated?api_key=${API_KEY}`).then(r => r.json()),
                fetch(`${BASE_URL}/movie/upcoming?api_key=${API_KEY}`).then(r => r.json())
            ]);

            // Create hero section with random trending item
            const heroItem = trending.results[Math.floor(Math.random() * trending.results.length)];
            const heroHTML = createHeroSection(heroItem);

            // Create content rows
            const contentHTML = `
                ${heroHTML}
                <div class="content-sections">
                    ${createContinueWatchingSection()}
                    ${createContentRow('Trending Now', trending.results)}
                    ${createContentRow('Top Rated Movies', topMovies.results)}
                    ${createContentRow('Top Rated Series', topSeries.results)}
                    ${createContentRow('Coming Soon', upcoming.results)}
                </div>
            `;

            mainContent.innerHTML = contentHTML;
            initializeSliders();

        } catch (error) {
            console.error('Error loading homepage:', error);
        }
    } else {
        let url;
        let title;

        if (currentSection === 'watchlist') {
            loadWatchlist();
            isLoading = false;
            return;
        }

        switch (currentSection) {
            case 'movies':
                url = `${BASE_URL}/movie/popular?api_key=${API_KEY}&page=${currentPage}`;
                title = 'Popular Movies';
                break;
            case 'series':
                url = `${BASE_URL}/tv/popular?api_key=${API_KEY}&page=${currentPage}`;
                title = 'Popular Series';
                break;
        }

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (currentPage === 1) {
                mainContent.innerHTML = `<h1>${title}</h1><div class="content-grid"></div>`;
            }

            const contentGrid = mainContent.querySelector('.content-grid');
            data.results.forEach(item => {
                const element = createContentCard(item);
                contentGrid.appendChild(element);
            });

            currentPage++;
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    }

    isLoading = false;
}

function createContentCard(item) {
    const card = document.createElement('div');
    card.className = 'content-card';
    const progress = getItemProgress(item.id);
    
    card.innerHTML = `
        <img src="${item.poster_path ? `${IMG_BASE_URL}${item.poster_path}` : DEFAULT_POSTER}" 
             alt="${item.title || item.name}">
        ${progress ? `
            <div class="progress-bar">
                <div class="progress" style="width: ${formatProgress(progress.progress)}"></div>
            </div>
        ` : ''}
        <div class="card-overlay">
            <div class="card-buttons">
                <button onclick="showInfo(${item.id}, '${item.media_type || (item.first_air_date ? 'tv' : 'movie')}')" class="card-btn info-btn">
                    <span>ℹ</span>
                </button>
                <button onclick="playContent(${item.id}, '${item.media_type || (item.first_air_date ? 'tv' : 'movie')}')" class="card-btn play-btn">
                    <span>▶</span>
                </button>
            </div>
            <h3>${item.title || item.name}</h3>
        </div>
    `;
    
    return card;
}

// Infinite scroll
window.addEventListener('scroll', () => {
    if (currentSection !== 'home' && 
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
        loadContent();
    }
});

// Watchlist functionality
function getWatchlist() {
    const watchlist = localStorage.getItem('watchlist');
    return watchlist ? JSON.parse(watchlist) : [];
}

function addToWatchlist(item) {
    const watchlist = getWatchlist();
    watchlist.push({
        id: item.id,
        title: item.title || item.name,
        poster_path: item.poster_path,
        media_type: item.media_type || (item.first_air_date ? 'tv' : 'movie'),
        overview: item.overview,
        vote_average: item.vote_average
    });
    localStorage.setItem('watchlist', JSON.stringify(watchlist));
}

function removeFromWatchlist(itemId) {
    const watchlist = getWatchlist();
    const updatedWatchlist = watchlist.filter(item => item.id !== itemId);
    localStorage.setItem('watchlist', JSON.stringify(updatedWatchlist));
}

function isInWatchlist(itemId) {
    const watchlist = getWatchlist();
    return watchlist.some(item => item.id === itemId);
}

function loadWatchlist() {
    const watchlist = getWatchlist();
    mainContent.innerHTML = `
        <h1>My Watchlist</h1>
        <div class="content-grid">
            ${watchlist.length ? '' : '<p class="empty-watchlist">Your watchlist is empty</p>'}
        </div>
    `;
    
    const contentGrid = mainContent.querySelector('.content-grid');
    watchlist.forEach(item => {
        const element = createContentCard(item);
        contentGrid.appendChild(element);
    });
}

// Initial load
loadContent();

async function showInfo(id, mediaType) {
    const modal = document.getElementById('info-modal');
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    try {
        const [details, credits, videos] = await Promise.all([
            fetch(`${BASE_URL}/${mediaType}/${id}?api_key=${API_KEY}`).then(r => r.json()),
            fetch(`${BASE_URL}/${mediaType}/${id}/credits?api_key=${API_KEY}`).then(r => r.json()),
            fetch(`${BASE_URL}/${mediaType}/${id}/videos?api_key=${API_KEY}`).then(r => r.json())
        ]);
        
        const trailer = videos.results.find(v => v.type === 'Trailer') || videos.results[0];
        const director = credits.crew.find(c => c.job === 'Director')?.name || 'N/A';
        const cast = credits.cast.slice(0, 5).map(c => c.name).join(', ');
        const year = new Date(details.release_date || details.first_air_date).getFullYear();
        const progress = getItemProgress(id);
        
        modal.querySelector('.modal-content').innerHTML = `
            <div class="modal-backdrop" style="background-image: url('https://image.tmdb.org/t/p/original${details.backdrop_path}')">
                <div class="modal-gradient"></div>
            </div>
            <div class="modal-content-wrapper">
                <div class="modal-header">
                    <h1>${details.title || details.name}</h1>
                    <button class="close-modal" onclick="closeModal()">×</button>
                </div>
                <div class="modal-main-content">
                    <div class="modal-poster">
                        <img src="${details.poster_path ? `${IMG_BASE_URL}${details.poster_path}` : DEFAULT_POSTER}" 
                             alt="${details.title || details.name}">
                    </div>
                    <div class="modal-info">
                        <div class="modal-meta">
                            <div class="meta-item rating">★ ${details.vote_average.toFixed(1)}</div>
                            <div class="meta-item">${year}</div>
                            ${details.runtime ? `<div class="meta-item">${Math.floor(details.runtime/60)}h ${details.runtime%60}m</div>` : ''}
                            ${details.number_of_seasons ? `<div class="meta-item">${details.number_of_seasons} Seasons</div>` : ''}
                        </div>
                        <div class="modal-actions">
                            <button onclick="playContent(${details.id}, '${mediaType}')" class="play-btn">
                                <span>▶</span> ${progress && progress.progress ? 'Continue Watching' : `Play ${mediaType === 'movie' ? 'Movie' : 'Series'}`}
                            </button>
                        </div>
                        <p class="modal-overview">${details.overview}</p>
                        <div class="modal-credits">
                            <div class="credit-item">
                                <label>Director</label>
                                <span>${director}</span>
                            </div>
                            <div class="credit-item">
                                <label>Cast</label>
                                <span>${cast}</span>
                            </div>
                        </div>
                        ${mediaType === 'tv' ? await generateSeasonsHTML(details.seasons, id) : ''}
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading details:', error);
    }
}

function closeModal() {
    const modal = document.getElementById('info-modal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

function toggleWatchlist(id, mediaType) {
    const isWatchlisted = isInWatchlist(id);
    const button = document.querySelector(`.${isWatchlisted ? 'remove-watchlist-btn' : 'add-watchlist-btn'}`);
    
    if (isWatchlisted) {
        removeFromWatchlist(id);
        button.className = 'add-watchlist-btn';
        button.innerHTML = '<span>+</span> Add to Watchlist';
    } else {
        fetch(`${BASE_URL}/${mediaType}/${id}?api_key=${API_KEY}`)
            .then(response => response.json())
            .then(item => {
                addToWatchlist(item);
                button.className = 'remove-watchlist-btn';
                button.innerHTML = '<span>✕</span> Remove from Watchlist';
            });
    }
}

async function generateSeasonsHTML(seasons, seriesId) {
    let seasonsHTML = `
        <div class="season-selector">
            <select id="seasonSelect" onchange="changeSeason(this.value, ${seriesId})">
                ${seasons
                    .filter(season => season.season_number !== 0)
                    .map(season => `
                        <option value="${season.season_number}">
                            Season ${season.season_number}
                        </option>
                    `).join('')}
            </select>
        </div>
        <div id="episodes-container" class="episodes-list">
    `;

    // Load first season episodes
    const firstSeason = seasons.find(s => s.season_number !== 0);
    if (firstSeason) {
        seasonsHTML += await loadSeasonEpisodes(seriesId, firstSeason.season_number);
    }

    return seasonsHTML + '</div>';
}

async function loadSeasonEpisodes(seriesId, seasonNumber) {
    try {
        const response = await fetch(
            `${BASE_URL}/tv/${seriesId}/season/${seasonNumber}?api_key=${API_KEY}`
        );
        const data = await response.json();
        
        return data.episodes.map(episode => `
            <div class="episode-item">
                <div class="episode-content">
                    <div class="episode-thumbnail">
                        <img src="${episode.still_path ? 
                            `${IMG_BASE_URL}${episode.still_path}` : 
                            DEFAULT_POSTER}" 
                            alt="${episode.name}">
                        <button class="play-episode-btn" 
                                onclick="showPlayer('tv', ${seriesId}, ${seasonNumber}, ${episode.episode_number})">
                            <span>▶</span>
                        </button>
                    </div>
                    <div class="episode-details">
                        <h4>Episode ${episode.episode_number}: ${episode.name}</h4>
                        <div class="episode-duration">${episode.runtime || '45'}m</div>
                        <p>${episode.overview || 'No overview available.'}</p>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading episodes:', error);
        return '<div class="error">Failed to load episodes</div>';
    }
}

// Add this new function to handle season changes
async function changeSeason(seasonNumber, seriesId) {
    const container = document.getElementById('episodes-container');
    container.innerHTML = '<div class="loading">Loading episodes...</div>';
    
    try {
        container.innerHTML = await loadSeasonEpisodes(seriesId, seasonNumber);
    } catch (error) {
        console.error('Error fetching season:', error);
        container.innerHTML = '<div class="error">Failed to load episodes</div>';
    }
}

// Add this new function to handle episode toggling
function toggleEpisodes(header) {
    const episodesContainer = header.nextElementSibling;
    const arrow = header.querySelector('.season-toggle');
    const isVisible = episodesContainer.style.display === 'block';
    
    episodesContainer.style.display = isVisible ? 'none' : 'block';
    arrow.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
}

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    const modal = document.getElementById('info-modal');
    if (e.target === modal) {
        modal.style.display = 'none';
    }
});

function createHeroSection(item) {
    const backdrop = `https://image.tmdb.org/t/p/original${item.backdrop_path}`;
    const title = item.title || item.name;
    const overview = item.overview;
    
    return `
        <div class="hero-section" style="background-image: url('${backdrop}')">
            <div class="hero-gradient"></div>
            <div class="hero-content">
                <h1>${title}</h1>
                <p>${overview}</p>
                <div class="hero-buttons">
                    <button class="play-btn" onclick="showInfo(${item.id}, '${item.media_type}')">
                        <span>▶</span> Play
                    </button>
                    <button class="more-info-btn" onclick="showInfo(${item.id}, '${item.media_type}')">
                        <span>ℹ</span> More Info
                    </button>
                </div>
            </div>
        </div>
    `;
}

function initializeSliders() {
    const sliders = document.querySelectorAll('.content-slider');
    sliders.forEach(slider => {
        let isDown = false;
        let startX;
        let scrollLeft;

        slider.addEventListener('mousedown', (e) => {
            isDown = true;
            slider.classList.add('active');
            startX = e.pageX - slider.offsetLeft;
            scrollLeft = slider.scrollLeft;
        });

        slider.addEventListener('mouseleave', () => {
            isDown = false;
            slider.classList.remove('active');
        });

        slider.addEventListener('mouseup', () => {
            isDown = false;
            slider.classList.remove('active');
        });

        slider.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - slider.offsetLeft;
            const walk = (x - startX) * 2;
            slider.scrollLeft = scrollLeft - walk;
        });
    });
}

function createContentRow(title, items) {
    return `
        <section class="content-row">
            <h2>${title}</h2>
            <div class="content-slider">
                ${items.map(item => createContentCard(item).outerHTML).join('')}
            </div>
            <button class="slider-controls slider-prev" onclick="slideContent(this, -1)">
                <div class="slider-button-bg">
                    <svg width="24" height="24" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
                    </svg>
                </div>
            </button>
            <button class="slider-controls slider-next" onclick="slideContent(this, 1)">
                <div class="slider-button-bg">
                    <svg width="24" height="24" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                    </svg>
                </div>
            </button>
        </section>
    `;
}

function slideContent(button, direction) {
    const slider = button.parentElement.querySelector('.content-slider');
    const cardWidth = slider.querySelector('.content-card').offsetWidth + 16; // 16 is the gap
    const scrollAmount = cardWidth * 4 * direction;
    slider.scrollBy({ left: scrollAmount, behavior: 'smooth' });
}

function createPlayButton(details, mediaType) {
    if (mediaType === 'movie') {
        return `
            <button class="play-btn" onclick="showPlayer('movie', ${details.id})">
                <span>▶</span> Play Movie
            </button>
        `;
    } else {
        return ''; // For TV shows, play buttons are added per episode
    }
}

function createEpisodePlayButton(seriesId, seasonNumber, episodeNumber) {
    return `
        <button class="play-episode-btn" onclick="showPlayer('tv', ${seriesId}, ${seasonNumber}, ${episodeNumber})">
            <span>▶</span>
        </button>
    `;
}

function showPlayer(type, id, season = null, episode = null) {
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
    
    const playerHTML = `
        <div class="player-wrapper">
            <button class="return-btn" onclick="closePlayer()">
                <svg width="24" height="24" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                </svg>
                Return
            </button>
            <div class="player-container">
                <iframe 
                    id="player-iframe" 
                    allowfullscreen
                    src="${getPlayerUrl(type, id, season, episode)}"
                ></iframe>
            </div>
        </div>
    `;
    
    mainContent.innerHTML = playerHTML;
    
    // Watch progress tracking
    window.addEventListener('message', (event) => {
        if (event.origin !== 'https://vidlink.pro') return;
        
        if (event.data && event.data.type === 'MEDIA_DATA') {
            localStorage.setItem('vidLinkProgress', JSON.stringify(event.data.data));
        }
    });
}

function closePlayer() {
    document.body.style.margin = '';
    document.body.style.overflow = 'auto';
    navigateTo(currentSection);
}

function getPlayerUrl(type, id, season, episode) {
    const baseUrl = 'https://vidlink.pro';
    let playerUrl = type === 'movie' 
        ? `${baseUrl}/movie/${id}` 
        : `${baseUrl}/tv/${id}/${season}/${episode}`;
        
    // Customization parameters
    const params = {
        primaryColor: '6366f1',      // Primary color (matches your app's theme)
        secondaryColor: '8b5cf6',    // Secondary color
        iconColor: '6366f1',         // Icon color
        icons: 'vid',                // Modern icon set
        title: 'true',               // Show title
        poster: 'true',              // Show poster
        autoplay: 'true',            // Autoplay enabled
        nextbutton: 'true'           // Show next episode button
    };
    
    // Convert params object to URL parameters
    const queryString = Object.entries(params)
        .map(([key, value]) => `${key}=${value}`)
        .join('&');
    
    return `${playerUrl}?${queryString}`;
}

// Watch Progress Helper Functions
function getWatchProgress() {
    const progress = localStorage.getItem('vidLinkProgress');
    return progress ? JSON.parse(progress) : {};
}

function getItemProgress(id) {
    const progress = getWatchProgress();
    return progress[id] || null;
}

function formatProgress(progress) {
    if (!progress) return '0%';
    const percentage = (progress.watched / progress.duration) * 100;
    return `${Math.round(percentage)}%`;
}

function getNextEpisode(id) {
    const progress = getItemProgress(id);
    if (!progress || progress.type !== 'tv') return { season: 1, episode: 1 };
    
    return {
        season: parseInt(progress.last_season_watched),
        episode: parseInt(progress.last_episode_watched)
    };
}

function playContent(id, mediaType) {
    if (mediaType === 'movie') {
        showPlayer('movie', id);
    } else {
        const progress = getItemProgress(id);
        if (progress) {
            showPlayer('tv', id, progress.last_season_watched, progress.last_episode_watched);
        } else {
            showPlayer('tv', id, 1, 1);
        }
    }
}

function getContinueWatchingItems() {
    const progress = getWatchProgress();
    return Object.values(progress)
        .filter(item => {
            if (!item.progress) return false;
            const percentage = (item.progress.watched / item.progress.duration) * 100;
            return percentage > 0 && percentage < 95; // Only show items that aren't finished
        })
        .sort((a, b) => b.last_updated - a.last_updated); // Most recently watched first
}

function createContinueWatchingSection() {
    const items = getContinueWatchingItems();
    if (items.length === 0) return '';
    
    return `
        <section class="content-row continue-watching">
            <h2>Continue Watching</h2>
            <div class="content-slider">
                ${items.map(item => {
                    const cardItem = {
                        id: item.id,
                        title: item.title,
                        poster_path: item.poster_path,
                        media_type: item.type,
                        progress: item.progress
                    };
                    return createContentCard(cardItem).outerHTML;
                }).join('')}
            </div>
            <button class="slider-controls slider-prev" onclick="slideContent(this, -1)">
                <div class="slider-button-bg">
                    <svg width="24" height="24" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
                    </svg>
                </div>
            </button>
            <button class="slider-controls slider-next" onclick="slideContent(this, 1)">
                <div class="slider-button-bg">
                    <svg width="24" height="24" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                    </svg>
                </div>
            </button>
        </section>
    `;
}

async function checkApiKey() {
    if (!API_KEY) {
        showApiKeyPrompt();
        return false;
    }
    
    try {
        const response = await fetch(`${BASE_URL}/movie/popular?api_key=${API_KEY}`);
        if (!response.ok) {
            localStorage.removeItem('tmdb_api_key');
            showApiKeyPrompt();
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error validating API key:', error);
        showApiKeyPrompt();
        return false;
    }
}

function showApiKeyPrompt() {
    mainContent.innerHTML = `
        <div class="api-key-container">
            <h1>Welcome to Hexa</h1>
            <p>Please enter your TMDB API key to continue:</p>
            <div class="api-key-form">
                <input type="text" id="api-key-input" placeholder="Enter your TMDB API key">
                <button onclick="submitApiKey()">Submit</button>
            </div>
            <p class="api-key-help">
                Don't have an API key? 
                <a href="https://www.themoviedb.org/settings/api" target="_blank">
                    Get one here
                </a>
            </p>
        </div>
    `;
}

async function submitApiKey() {
    const input = document.getElementById('api-key-input');
    const key = input.value.trim();
    
    if (!key) {
        alert('Please enter an API key');
        return;
    }
    
    try {
        const response = await fetch(`${BASE_URL}/movie/popular?api_key=${key}`);
        if (!response.ok) {
            alert('Invalid API key. Please try again.');
            return;
        }
        
        API_KEY = key;
        localStorage.setItem('tmdb_api_key', key);
        currentSection = 'home';
        loadContent();
    } catch (error) {
        console.error('Error validating API key:', error);
        alert('Error validating API key. Please try again.');
    }
}

// Initialize the app
async function init() {
    if (!API_KEY) {
        showApiKeyPrompt();
        return;
    }
    
    if (await checkApiKey()) {
        loadContent();
    }
}

// Start the app
init();
