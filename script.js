const CONFIG = { baseUrl: 'https://vidlink.pro' };
let API_KEY = localStorage.getItem('tmdb_api_key');
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const DEFAULT_POSTER = 'https://via.placeholder.com/500x750?text=No+Poster';
const DEFAULT_STILL = 'https://via.placeholder.com/200x300?text=No+Still';

let currentPage = 1;
let currentSection = 'home';
let isLoading = false;

let currentMediaType = 'all';

const DOM = {
  mainContent: document.getElementById('main-content'),
  modal: document.getElementById('info-modal'),
  apiKeyInput: document.getElementById('api-key-input')
};

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
    DOM.mainContent.innerHTML = '';
    isLoading = false;
    loadContent();
}

async function loadContent() {
    if (isLoading || !API_KEY) return;
    isLoading = true;

    if (currentSection === 'genre') {
        const genreId = document.querySelector('.page-header').dataset.genreId;
        const genreName = document.querySelector('.page-header h1').textContent;
        await loadGenreContent(genreId, genreName);
        return;
    }

    if (currentSection === 'home') {
        try {
            const [trending, topMovies, topSeries, upcoming] = await Promise.all([
                fetch(`${BASE_URL}/trending/all/day?api_key=${API_KEY}`).then(r => r.json()),
                fetch(`${BASE_URL}/movie/top_rated?api_key=${API_KEY}`).then(r => r.json()),
                fetch(`${BASE_URL}/tv/top_rated?api_key=${API_KEY}`).then(r => r.json()),
                fetch(`${BASE_URL}/movie/upcoming?api_key=${API_KEY}`).then(r => r.json())
            ]);

            const heroItem = trending.results[Math.floor(Math.random() * trending.results.length)];
            const heroHTML = createHeroSection(heroItem);
            const recommendationsHTML = await loadRecommendations();
            const continueWatchingHTML = createContinueWatchingSection();
            
            const contentHTML = `
                ${heroHTML}
                <div class="content-sections">
                    ${continueWatchingHTML}
                    ${recommendationsHTML}
                    ${createContentRow('Trending Now', trending.results)}
                    ${createContentRow('Top Rated Movies', topMovies.results)}
                    ${createContentRow('Top Rated Series', topSeries.results)}
                    ${createContentRow('Coming Soon', upcoming.results)}
                </div>
            `;

            DOM.mainContent.innerHTML = contentHTML;
            initializeSliders();

        } catch (error) {
            console.error('Error loading homepage:', error);
        }
    } else if (currentSection === 'movies' || currentSection === 'series') {
        let url;
        if (currentSection === 'movies') {
            url = `${BASE_URL}/movie/popular?api_key=${API_KEY}&page=${currentPage}`;
        } else {
            url = `${BASE_URL}/tv/popular?api_key=${API_KEY}&page=${currentPage}`;
        }

        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (currentPage === 1) {
                const title = currentSection === 'movies' ? 'Movies' : 'TV Series';
                DOM.mainContent.innerHTML = `
                    <div class="page-content">
                        <div class="content-grid"></div>
                    </div>
                `;
            }

            const contentGrid = DOM.mainContent.querySelector('.content-grid');
            data.results.forEach(item => {
                const element = createContentCard(item);
                contentGrid.appendChild(element)
            });

            currentPage++;
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    } else if (currentSection === 'series') {
        try {
            const popular = await fetch(`${BASE_URL}/tv/popular?api_key=${API_KEY}&page=${currentPage}`).then(r => r.json());

            let combinedResults = [...popular.results, ...topRated.results, ...trending.results];
            
            combinedResults = Array.from(new Set(combinedResults.map(s => s.id)))
                .map(id => combinedResults.find(s => s.id === id));

            combinedResults.sort((a, b) => {
                const scoreA = (a.popularity * 0.4) + (a.vote_average * 0.6);
                const scoreB = (b.popularity * 0.4) + (b.vote_average * 0.6);
                return scoreB - scoreA;
            });

            combinedResults = combinedResults.filter(show => 
                show.vote_average >= 7.0 && 
                show.vote_count >= 1000
            );

            if (currentPage === 1) {
                DOM.mainContent.innerHTML = `
                    <div class="page-content">
                        <div class="content-grid"></div>
                    </div>
                `;
            }

            const contentGrid = DOM.mainContent.querySelector('.content-grid');
            combinedResults.forEach(item => {
                const element = createContentCard(item);
                contentGrid.appendChild(element);
            });

            currentPage++;
        } catch (error) {
            console.error('Error fetching series:', error);
        }
    } else if (currentSection === 'genres') {
        loadGenrePage();
    } else if (currentSection === 'genre') {
        const genreId = document.querySelector('.page-header').dataset.genreId;
        const genreName = document.querySelector('.page-header h1').textContent;
        await loadGenreContent(genreId, genreName);
    }

    isLoading = false;
}

function createContentCard(item) {
    const card = document.createElement('div');
    card.className = 'content-card';
    card.setAttribute('data-id', item.id);
    
    card.innerHTML = `
        <img src="${item.poster_path ? `${IMG_BASE_URL}${item.poster_path}` : DEFAULT_POSTER}" 
             alt="${item.title || item.name}">
        <div class="card-overlay">
            <div class="card-buttons">
                <button onclick="showInfo(${item.id}, '${item.media_type || (item.first_air_date ? 'tv' : 'movie')}')" class="card-btn info-btn">
                    <span>ℹ️</span>
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

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

window.addEventListener('scroll', debounce(() => {
    if ((window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 1000) {
        if (!isLoading) {
            if (currentSection === 'genre') {
                const genreId = document.querySelector('.page-header').dataset.genreId;
                const genreName = document.querySelector('.page-header h1').textContent;
                loadGenreContent(genreId, genreName);
            } else if (currentSection === 'movies' || currentSection === 'series') {
                loadContent();
            }
        }
    }
}, 150));

async function showInfo(id, mediaType) {
    const modal = document.getElementById('info-modal');
    modal.style.display = 'block';
    document.body.classList.add('modal-open');
    
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
        
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modalContent.innerHTML = `
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
                            ${createPlayButton(details, mediaType)}
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
                        ${mediaType === 'tv' ? await generateSeasonsHTML(details.id, details.seasons) : ''}
                    </div>
                </div>
            </div>
        `;
        
        modal.innerHTML = '';
        modal.appendChild(modalContent);
    } catch (error) {
        console.error('Error loading details:', error);
    }
}

function closeModal() {
    DOM.modal.style.display = 'none';
    document.body.classList.remove('modal-open');
}

async function generateSeasonsHTML(seriesId, seasons) {
    if (!seasons || !Array.isArray(seasons)) return '';
    
    const validSeasons = seasons.filter(season => season.season_number !== 0);
    const currentSeason = validSeasons[0].season_number;
    
    return `
        <div class="seasons-section">
            <div class="season-header">
                <h3>Episodes</h3>
                <div class="season-select-wrapper">
                    <div class="season-select-header" onclick="toggleSeasonSelect(this)">
                        Season ${currentSeason}
                    </div>
                    <div class="season-options">
                        ${validSeasons.map(season => `
                            <div class="season-option ${season.season_number === currentSeason ? 'selected' : ''}" 
                                 onclick="selectSeason(this, ${season.season_number}, ${seriesId})">
                                Season ${season.season_number}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            <div id="episodes-container">
                ${await loadSeasonEpisodes(seriesId, currentSeason)}
            </div>
        </div>
    `;
}

function toggleSeasonSelect(header) {
    const wrapper = header.parentElement;
    wrapper.classList.toggle('open');
    
    if (wrapper.classList.contains('open')) {
        document.addEventListener('click', function closeSelect(e) {
            if (!wrapper.contains(e.target)) {
                wrapper.classList.remove('open');
                document.removeEventListener('click', closeSelect);
            }
        });
    }
}

async function selectSeason(option, seasonNumber, seriesId) {
    const wrapper = option.closest('.season-select-wrapper');
    wrapper.querySelectorAll('.season-option').forEach(opt => opt.classList.remove('selected'));
    option.classList.add('selected');
    
    wrapper.querySelector('.season-select-header').textContent = `Season ${seasonNumber}`;
    
    wrapper.classList.remove('open');
    
    const container = document.getElementById('episodes-container');
    container.innerHTML = '<div class="loading">Loading episodes...</div>';
    
    try {
        container.innerHTML = await loadSeasonEpisodes(seriesId, seasonNumber);
    } catch (error) {
        console.error('Error fetching season:', error);
        container.innerHTML = '<div class="error">Failed to load episodes</div>';
    }
}

async function loadSeasonEpisodes(seriesId, seasonNumber) {
    try {
        const response = await fetch(
            `${BASE_URL}/tv/${seriesId}/season/${seasonNumber}?api_key=${API_KEY}`
        );
        const data = await response.json();
        
        return data.episodes.map(episode => createEpisodeCard(episode, seriesId, seasonNumber)).join('');
    } catch (error) {
        console.error('Error loading episodes:', error);
        return '<div class="error">Failed to load episodes</div>';
    }
}

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

function toggleEpisodes(header) {
    const episodesContainer = header.nextElementSibling;
    const arrow = header.querySelector('.season-toggle');
    const isVisible = episodesContainer.style.display === 'block';
    
    episodesContainer.style.display = isVisible ? 'none' : 'block';
    arrow.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
}

window.addEventListener('click', (e) => {
    if (e.target === DOM.modal) {
        closeModal();
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
        let isDragging = false;

        slider.addEventListener('mousedown', (e) => {
            isDown = true;
            slider.classList.add('active');
            startX = e.pageX - slider.offsetLeft;
            scrollLeft = slider.scrollLeft;
        });

        slider.addEventListener('mouseleave', () => {
            isDown = false;
            isDragging = false;
            slider.classList.remove('active');
            restoreCardInteractions(slider);
        });

        slider.addEventListener('mouseup', () => {
            isDown = false;
            slider.classList.remove('active');
            
            setTimeout(() => {
                isDragging = false;
                restoreCardInteractions(slider);
            }, 10);
        });

        slider.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            isDragging = true;
            const x = e.pageX - slider.offsetLeft;
            const walk = (x - startX);
            slider.scrollLeft = scrollLeft - walk;
            
            // Disable pointer events only when actually dragging
            slider.querySelectorAll('.content-card').forEach(card => {
                card.style.pointerEvents = 'none';
            });
        });
    });
}

function restoreCardInteractions(slider) {
    slider.querySelectorAll('.content-card').forEach(card => {
        card.style.pointerEvents = 'auto';
        const overlay = card.querySelector('.card-overlay');
        if (overlay) {
            overlay.style.display = 'none';
            overlay.offsetHeight; // Force repaint
            overlay.style.display = '';
        }
    });
}

function createContentRow(title, items) {
    return `
        <div class="content-row">
            <h2>${title}</h2>
            <div class="slider-wrapper">
                <button class="slider-controls slider-prev" onclick="slideContent(this, -1)">❮</button>
                <div class="content-slider">
                    ${items.map(item => createContentCard(item).outerHTML).join('')}
                </div>
                <button class="slider-controls slider-next" onclick="slideContent(this, 1)">❯</button>
            </div>
        </div>
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
            <button class="modal-play-btn" onclick="showPlayer('movie', ${details.id})">
                <span>▶</span> Play Movie
            </button>
        `;
    } else if (mediaType === 'tv') {
        const progressData = localStorage.getItem('vidLinkProgress');
        if (progressData) {
            const progress = JSON.parse(progressData);
            const showProgress = progress[details.id];
            
            if (showProgress) {
                return `
                    <button class="modal-play-btn" onclick="showPlayer('tv', ${details.id}, ${showProgress.last_season_watched}, ${showProgress.last_episode_watched})">
                        <span>▶</span> Continue S${showProgress.last_season_watched} E${showProgress.last_episode_watched}
                    </button>
                    <button class="modal-play-btn secondary" onclick="showPlayer('tv', ${details.id}, 1, 1)">
                        <span>▶</span> Start from Beginning
                    </button>
                `;
            }
        }
        
        return `
            <button class="modal-play-btn" onclick="showPlayer('tv', ${details.id}, 1, 1)">
                <span>▶</span> Play Series
            </button>
        `;
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
    const mainContent = document.getElementById('main-content');
    document.body.style.overflow = 'hidden';
    
    // Add event listener for watch progress
    window.addEventListener('message', handleWatchProgress);
    
    const playerHTML = `
        <div class="player-wrapper">
            <button class="return-btn" onclick="closePlayer()">
                <svg viewBox="0 0 24 24">
                    <path fill="currentColor" d="M19 11H7.14l3.63-4.36a1 1 0 1 0-1.54-1.28l-5 6a1.19 1.19 0 0 0-.09.15c0 .05 0 .08-.07.13A1 1 0 0 0 4 12a1 1 0 0 0 .07.36c0 .05 0 .08.07.13a1.19 1.19 0 0 0 .09.15l5 6A1 1 0 0 0 10 19a1 1 0 0 0 .64-.23 1 1 0 0 0 .13-1.41L7.14 13H19a1 1 0 0 0 0-2z"/>
                </svg>
                Return to Browse
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
}

function closePlayer() {
    window.removeEventListener('message', handleWatchProgress);
    const mainContent = document.getElementById('main-content');
    document.body.style.overflow = '';
    loadContent();
}

function getPlayerUrl(type, id, season, episode) {
    let playerUrl = type === 'movie' 
        ? `${CONFIG.baseUrl}/movie/${id}` 
        : `${CONFIG.baseUrl}/tv/${id}/${season}/${episode}`;
        
    const params = new URLSearchParams({
        primaryColor: '6366f1',
        secondaryColor: '8b5cf6',
        iconColor: '6366f1',
        icons: 'vid'
    });
    
    return `${playerUrl}?${params.toString()}`;
}

function playContent(id, mediaType) {
    if (mediaType === 'movie') {
        showPlayer('movie', id);
    } else {
        showPlayer('tv', id, 1, 1);
    }
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
    document.body.classList.add('welcome-page');
    document.querySelector('header').style.display = 'none';
    
    DOM.mainContent.innerHTML = `
        <div class="api-key-container">
            <div class="welcome-header">
                <img src="images/logo.png" alt="Hexa Logo" class="welcome-logo">
                <h1>Get Started with Hexa</h1>
                <p class="welcome-subtitle">Your personal movie and TV show streaming companion</p>
            </div>

            <div class="welcome-features">
                <div class="feature-item">
                    <svg class="feature-icon" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm4.59-12.42L10 14.17l-2.59-2.58L6 13l4 4 8-8z"/>
                    </svg>
                    <span>Free Access</span>
                </div>
                <div class="feature-item">
                    <svg class="feature-icon" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM8 15c0-1.66 1.34-3 3-3 .35 0 .69.07 1 .18V6h5v2h-3v7.03c-.02 1.64-1.35 2.97-3 2.97-1.66 0-3-1.34-3-3z"/>
                    </svg>
                    <span>HD Streaming</span>
                </div>
                <div class="feature-item">
                    <svg class="feature-icon" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                    </svg>
                    <span>Top Rated</span>
                </div>
                <div class="feature-item">
                    <svg class="feature-icon" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M19 13H5v-2h14v2z"/>
                    </svg>
                    <span>No Ads</span>
                </div>
                <div class="feature-item">
                    <svg class="feature-icon" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm4.59-12.42L10 14.17l-2.59-2.58L6 13l4 4 8-8z"/>
                    </svg>
                    <span>100k+ Movies</span>
                </div>
                <div class="feature-item">
                    <svg class="feature-icon" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM8 15c0-1.66 1.34-3 3-3 .35 0 .69.07 1 .18V6h5v2h-3v7.03c-.02 1.64-1.35 2.97-3 2.97-1.66 0-3-1.34-3-3z"/>
                    </svg>
                    <span>70k+ Series</span>
                </div>
            </div>

            <div class="api-key-section">
                <form class="api-key-form" onsubmit="handleApiKeySubmit(event)">
                    <input 
                        type="text" 
                        id="api-key-input" 
                        placeholder="Enter your TMDB API key" 
                        required
                        autocomplete="off"
                        spellcheck="false"
                    >
                    <button type="submit">Start Watching</button>
                </form>
                <div class="api-key-help">
                    <p>Don't have an API key?</p>
                    <ol>
                        <li>Sign up for a free account at <a href="https://www.themoviedb.org/signup" target="_blank">TMDB</a></li>
                        <li>Go to your <a href="https://www.themoviedb.org/settings/api" target="_blank">API settings</a></li>
                        <li>Generate a new API key (v3 auth)</li>
                    </ol>
                </div>
            </div>
        </div>
    `;
    DOM.apiKeyInput = document.getElementById('api-key-input');
}

async function handleApiKeySubmit(event) {
    event.preventDefault();
    const input = document.getElementById('api-key-input').value.trim();
    
    if (!input) {
        alert('Please enter an API key');
        return;
    }
    
    try {
        const response = await fetch(`${BASE_URL}/movie/popular?api_key=${input}`);
        if (!response.ok) {
            alert('Invalid API key. Please try again.');
            return;
        }
        
        API_KEY = input;
        localStorage.setItem('tmdb_api_key', input);
        
        document.body.classList.remove('welcome-page');
        
        currentSection = 'home';
        await loadContent();
        
        document.querySelector('header').style.display = 'block';
        
    } catch (error) {
        console.error('Error validating API key:', error);
        alert('Error validating API key. Please try again.');
    }
}

async function init() {
    API_KEY = localStorage.getItem('tmdb_api_key');
    
    if (!API_KEY) {
        showApiKeyPrompt();
        return;
    }
    
    try {
        const response = await fetch(`${BASE_URL}/movie/popular?api_key=${API_KEY}`);
        if (!response.ok) {
            localStorage.removeItem('tmdb_api_key');
            showApiKeyPrompt();
            return;
        }
        
        document.querySelector('header').style.display = 'block';
        await loadContent();
        
    } catch (error) {
        console.error('Error checking API key:', error);
        localStorage.removeItem('tmdb_api_key');
        showApiKeyPrompt();
    }
}

function createEpisodeCard(episode, seriesId, seasonNumber) {
    return `
        <div class="episode-item">
            <div class="episode-content">
                <div class="episode-thumbnail">
                    <img src="${episode.still_path ? `${IMG_BASE_URL}${episode.still_path}` : DEFAULT_STILL}" 
                         alt="Episode ${episode.episode_number}">
                </div>
                <div class="episode-details">
                    <div class="episode-meta">
                        <span class="episode-number">Episode ${episode.episode_number}</span>
                        <span class="episode-duration">42m</span>
                    </div>
                    <h4>${episode.name}</h4>
                    <p>${episode.overview || 'No description available.'}</p>
                </div>
                <button onclick="showPlayer('tv', ${seriesId}, ${seasonNumber}, ${episode.episode_number})" 
                        class="episode-play-btn">
                    <span></span>
                </button>
            </div>
        </div>
    `;
}

let searchTimeout;

async function handleSearch() {
    const query = document.getElementById('search-input').value.trim();
    if (!query) return;
    
    currentSection = 'search';
    currentPage = 1;
    DOM.mainContent.innerHTML = `
        <div class="page-content">
            <div class="page-header">
                <h1>Search Results for "${query}"</h1>
            </div>
            <div class="content-grid"></div>
        </div>
    `;
    
    try {
        const [movies, shows] = await Promise.all([
            fetch(`${BASE_URL}/search/movie?api_key=${API_KEY}&query=${query}`).then(r => r.json()),
            fetch(`${BASE_URL}/search/tv?api_key=${API_KEY}&query=${query}`).then(r => r.json())
        ]);
        
        const contentGrid = DOM.mainContent.querySelector('.content-grid');
        const combinedResults = [...movies.results, ...shows.results]
            .sort((a, b) => b.popularity - a.popularity);
        
        if (combinedResults.length === 0) {
            contentGrid.innerHTML = '<p class="empty-results">No results found</p>';
            return;
        }
        
        combinedResults.forEach(item => {
            const element = createContentCard(item);
            contentGrid.appendChild(element);
        });
    } catch (error) {
        console.error('Error searching:', error);
    }
}

// Add these event listeners after DOM initialization
document.getElementById('search-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleSearch();
    }
});

document.getElementById('search-button').addEventListener('click', handleSearch);

// Anti-inspect code
(function() {
    let devtoolsOpen = false;
    const clownOverlay = document.getElementById('clown-overlay');

    function showClown() {
        if (!devtoolsOpen) {
            devtoolsOpen = true;
            document.body.style.overflow = 'hidden';
            clownOverlay.style.display = 'flex';
            Array.from(document.body.children).forEach(child => {
                if (child !== clownOverlay) {
                    child.style.display = 'none';
                }
            });
        }
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
            e.preventDefault();
            showClown();
        }
    });

    let element = new Image();
    Object.defineProperty(element, 'id', {
        get: function() {
            devtoolsOpen = true;
            showClown();
        }
    });

    const checkDevTools = () => {
        if (window.outerHeight - window.innerHeight > 200 || 
            window.outerWidth - window.innerWidth > 200) {
            showClown();
        }
    };

    setInterval(checkDevTools, 1000);
})();

loadContent();

document.addEventListener('DOMContentLoaded', init);

function handleWatchProgress(event) {
    if (event.origin !== 'https://vidlink.pro') {
        return;
    }

    if (event.data && event.data.type === 'MEDIA_DATA') {
        const mediaData = event.data.data;
        localStorage.setItem('vidLinkProgress', JSON.stringify(mediaData));
        updateContinueWatchingSection();
    }
}

function createContinueWatchingSection() {
    const progressData = localStorage.getItem('vidLinkProgress');
    if (!progressData) return '';

    const progress = JSON.parse(progressData);
    const items = Object.values(progress)
        .sort((a, b) => b.last_updated - a.last_updated)
        .slice(0, 10); // Show only last 10 items

    if (items.length === 0) return '';

    return `
        <div class="content-row">
            <h2>Continue Watching</h2>
            <div class="slider-wrapper">
                <button class="slider-controls slider-prev" onclick="slideContent(this, -1)">❮</button>
                <div class="content-slider">
                    ${items.map(item => createProgressCard(item)).join('')}
                </div>
                <button class="slider-controls slider-next" onclick="slideContent(this, 1)">❯</button>
            </div>
        </div>
    `;
}

function createProgressCard(item) {
    const progress = item.type === 'tv' 
        ? (parseInt(item.last_episode_watched) / item.number_of_episodes) * 100
        : (item.progress.watched / item.progress.duration) * 100;

    const card = document.createElement('div');
    card.className = 'content-card';
    card.setAttribute('data-id', item.id);
    
    card.innerHTML = `
        <img src="${item.poster_path ? `${IMG_BASE_URL}${item.poster_path}` : DEFAULT_POSTER}" 
             alt="${item.title}">
        <div class="card-overlay">
            <div class="progress-bar">
                <div class="progress" style="width: ${Math.min(progress, 100)}%"></div>
            </div>
            <div class="card-buttons">
                <button onclick="showInfo(${item.id}, '${item.type}')" class="card-btn info-btn">
                    <span>ℹ️</span>
                </button>
                <button onclick="resumeContent(${item.id}, '${item.type}')" class="card-btn play-btn">
                    <span>▶</span>
                </button>
            </div>
            <h3>${item.title}</h3>
            ${item.type === 'tv' ? `<p>S${item.last_season_watched} E${item.last_episode_watched}</p>` : ''}
        </div>
    `;
    
    return card.outerHTML;
}

function resumeContent(id, type) {
    const progressData = JSON.parse(localStorage.getItem('vidLinkProgress'));
    const item = progressData[id];
    
    if (type === 'tv') {
        showPlayer('tv', id, item.last_season_watched, item.last_episode_watched);
    } else {
        showPlayer('movie', id);
    }
}

function updateContinueWatchingSection() {
    const continueWatchingRow = document.querySelector('.content-row:first-child');
    if (continueWatchingRow) {
        const newContinueWatchingHTML = createContinueWatchingSection();
        if (newContinueWatchingHTML) {
            continueWatchingRow.outerHTML = newContinueWatchingHTML;
            initializeSliders();
        } else {
            continueWatchingRow.remove();
        }
    } else if (document.querySelector('.content-sections')) {
        const newContinueWatchingHTML = createContinueWatchingSection();
        if (newContinueWatchingHTML) {
            const contentSections = document.querySelector('.content-sections');
            contentSections.insertAdjacentHTML('afterbegin', newContinueWatchingHTML);
            initializeSliders();
        }
    }
}

async function loadRecommendations() {
    const progressData = localStorage.getItem('vidLinkProgress');
    if (!progressData) return '';

    const progress = JSON.parse(progressData);
    const lastWatched = Object.values(progress)
        .sort((a, b) => b.last_updated - a.last_updated)[0];

    if (!lastWatched) return '';

    try {
        const response = await fetch(
            `${BASE_URL}/${lastWatched.type}/${lastWatched.id}/recommendations?api_key=${API_KEY}`
        );
        const data = await response.json();
        
        if (data.results.length === 0) return '';

        return `
            <div class="content-row">
                <h2>Because You Watched ${lastWatched.title}</h2>
                <div class="slider-wrapper">
                    <button class="slider-controls slider-prev" onclick="slideContent(this, -1)">❮</button>
                    <div class="content-slider">
                        ${data.results.map(item => createContentCard(item).outerHTML).join('')}
                    </div>
                    <button class="slider-controls slider-next" onclick="slideContent(this, 1)">❯</button>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading recommendations:', error);
        return '';
    }
}

async function loadGenrePage() {
    try {
        const [movieGenres, tvGenres] = await Promise.all([
            fetch(`${BASE_URL}/genre/movie/list?api_key=${API_KEY}`).then(r => r.json()),
            fetch(`${BASE_URL}/genre/tv/list?api_key=${API_KEY}`).then(r => r.json())
        ]);

        const genreCardsHTML = `
            <div class="page-content genres-page">
                <div class="genre-type-tabs">
                    <button class="genre-tab active" data-type="movies">Movies</button>
                    <button class="genre-tab" data-type="tv">TV Shows</button>
                </div>
                <div class="genres-container">
                    <div class="genre-section movies active" id="movies-genres">
                        <div class="genres-grid">
                            ${movieGenres.genres.map(genre => `
                                <div class="genre-card" onclick="showGenreContent(${genre.id}, '${genre.name}', 'movie')">
                                    <h3>${genre.name}</h3>
                                    <div class="genre-count">Movies</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="genre-section tv" id="tv-genres">
                        <div class="genres-grid">
                            ${tvGenres.genres.map(genre => `
                                <div class="genre-card" onclick="showGenreContent(${genre.id}, '${genre.name}', 'tv')">
                                    <h3>${genre.name}</h3>
                                    <div class="genre-count">TV Shows</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        DOM.mainContent.innerHTML = genreCardsHTML;

        // Add tab switching functionality
        document.querySelectorAll('.genre-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.genre-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.genre-section').forEach(s => s.classList.remove('active'));
                
                tab.classList.add('active');
                const type = tab.dataset.type;
                document.getElementById(`${type}-genres`).classList.add('active');
            });
        });

    } catch (error) {
        console.error('Error loading genres:', error);
        DOM.mainContent.innerHTML = `
            <div class="page-content">
                <div class="empty-results">Error loading genres. Please try again.</div>
            </div>
        `;
    }
}

async function showGenreContent(genreId, genreName, mediaType) {
    currentSection = 'genre';
    currentPage = 1;
    currentMediaType = mediaType;
    
    try {
        DOM.mainContent.innerHTML = `
            <div class="page-content">
                <div class="page-header" data-genre-id="${genreId}">
                    <h1>${genreName}</h1>
                    <button class="back-btn" onclick="loadGenrePage()">
                        <span>←</span> Back to Genres
                    </button>
                </div>
                <div class="content-grid"></div>
            </div>
        `;

        await loadGenreContent(genreId, genreName);
    } catch (error) {
        console.error('Error loading genre content:', error);
    }
}

async function loadGenreContent(genreId, genreName) {
    if (isLoading) return;
    isLoading = true;

    try {
        const contentGrid = document.querySelector('.content-grid');
        
        if (currentMediaType === 'movie') {
            await loadMovieGenreContent(genreId, contentGrid);
        } else {
            await loadTVGenreContent(genreId, contentGrid);
        }

        isLoading = false;
    } catch (error) {
        console.error('Error loading genre content:', error);
        isLoading = false;
    }
}

async function loadMovieGenreContent(genreId, contentGrid) {
    try {
        const response = await fetch(
            `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=${genreId}&page=${currentPage}`
        );
        const data = await response.json();
        
        if (data.results.length === 0) {
            if (currentPage === 1) {
                contentGrid.innerHTML = '<div class="empty-results">No movies found in this genre</div>';
            }
            return;
        }

        data.results.forEach(item => {
            item.media_type = 'movie';
            const element = createContentCard(item);
            contentGrid.appendChild(element);
        });

        currentPage++;
    } catch (error) {
        console.error('Error loading movie genre content:', error);
        if (currentPage === 1) {
            contentGrid.innerHTML = '<div class="empty-results">Error loading movies</div>';
        }
    }
}

async function loadTVGenreContent(genreId, contentGrid) {
    try {
        const response = await fetch(
            `${BASE_URL}/discover/tv?api_key=${API_KEY}&with_genres=${genreId}&page=${currentPage}`
        );
        const data = await response.json();
        
        if (data.results.length === 0) {
            if (currentPage === 1) {
                contentGrid.innerHTML = '<div class="empty-results">No TV shows found in this genre</div>';
            }
            return;
        }

        data.results.forEach(item => {
            item.media_type = 'tv';
            const element = createContentCard(item);
            contentGrid.appendChild(element);
        });

        currentPage++;
    } catch (error) {
        console.error('Error loading TV genre content:', error);
        if (currentPage === 1) {
            contentGrid.innerHTML = '<div class="empty-results">Error loading TV shows</div>';
        }
    }
}
