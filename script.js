const CONFIG = { baseUrl: 'https://vidlink.pro' };
const API_KEY = '8908a80d66eae13bd34f357ec5bc1db8'; // Replace with your actual API key
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
            const [
                trending, 
                topMovies, 
                topSeries, 
                upcoming,
                popular
            ] = await Promise.all([
                fetch(`${BASE_URL}/trending/all/day?api_key=${API_KEY}`).then(r => r.json()),
                fetch(`${BASE_URL}/movie/top_rated?api_key=${API_KEY}`).then(r => r.json()),
                fetch(`${BASE_URL}/tv/top_rated?api_key=${API_KEY}`).then(r => r.json()),
                fetch(`${BASE_URL}/movie/upcoming?api_key=${API_KEY}`).then(r => r.json()),
                fetch(`${BASE_URL}/movie/popular?api_key=${API_KEY}`).then(r => r.json())
            ]);

            const heroItem = trending.results[Math.floor(Math.random() * trending.results.length)];
            const heroHTML = createHeroSection(heroItem);
            const continueWatchingHTML = createContinueWatchingSection();
            const recommendationsHTML = await loadRecommendations();
            const genreBasedHTML = await loadGenreBasedRecommendations();
            const watchTimeBasedHTML = await loadWatchTimeBasedContent();
            const popularInRegionHTML = await loadPopularInRegion();
            
            const contentHTML = `
                ${heroHTML}
                <div class="content-sections">
                    ${continueWatchingHTML}
                    ${recommendationsHTML}
                    ${genreBasedHTML}
                    ${watchTimeBasedHTML}
                    ${popularInRegionHTML}
                    ${createContentRow('Trending Now', trending.results)}
                    ${createContentRow('Top Rated Movies', topMovies.results)}
                    ${createContentRow('Top Rated Series', topSeries.results)}
                    ${createContentRow('Popular This Week', popular.results)}
                    ${createContentRow('Coming Soon', upcoming.results)}
                </div>
            `;

            DOM.mainContent.innerHTML = contentHTML;
            initializeSliders();
            
        } catch (error) {
            console.error('Error loading homepage:', error);
        }
    } else if (currentSection === 'movies' || currentSection === 'series') {
        const mediaType = currentSection === 'movies' ? 'movie' : 'tv';
        
        if (currentPage === 1) {
            DOM.mainContent.innerHTML = `
                <div class="page-content">
                    <div class="page-header">
                        <h1>${currentSection === 'movies' ? 'Movies' : 'TV Series'}</h1>
                    </div>
                    ${createFilterSection(mediaType)}
                    <div class="content-grid"></div>
                </div>
            `;
            
            // Add filter event listeners
            document.querySelectorAll('.filter-select').forEach(select => {
                select.addEventListener('change', async () => {
                    currentPage = 1;
                    const contentGrid = DOM.mainContent.querySelector('.content-grid');
                    contentGrid.innerHTML = '';
                    const results = await applyFilters(mediaType);
                    results.forEach(item => {
                        item.media_type = mediaType;
                        const element = createContentCard(item);
                        contentGrid.appendChild(element);
                    });
                });
            });
        }
        
        const results = await applyFilters(mediaType);
        const contentGrid = DOM.mainContent.querySelector('.content-grid');
        results.forEach(item => {
            item.media_type = mediaType;
            const element = createContentCard(item);
            contentGrid.appendChild(element);
        });
        
        currentPage++;
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
    } else if (currentSection === 'watchlist') {
        await loadWatchlistContent();
    }

    isLoading = false;
}

function createContentCard(item) {
    const card = document.createElement('div');
    card.className = 'content-card';
    card.setAttribute('data-id', item.id);
    
    const isWatchlisted = isInWatchlist(item.id);
    const isWatchlistPage = currentSection === 'watchlist';
    
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
                <button onclick="${isWatchlisted ? `removeFromWatchlist(${item.id})` : `addToWatchlist(${JSON.stringify(item).replace(/"/g, '&quot;')})`}" 
                        class="card-btn watchlist-btn ${isWatchlisted ? 'active' : ''}">
                    <span>${isWatchlistPage ? '✕' : (isWatchlisted ? '✓' : '+')}</span>
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

// Lazy loading images
function lazyLoadImages() {
    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                observer.unobserve(img);
            }
        });
    });

    images.forEach(img => imageObserver.observe(img));
}

// Content preloading
function preloadContent(page) {
    if (navigator.connection && navigator.connection.saveData) {
        return; // Respect data saver mode
    }
    
    const preloadPages = {
        home: ['movies', 'series'],
        movies: ['genres'],
        series: ['genres']
    };

    if (preloadPages[page]) {
        preloadPages[page].forEach(nextPage => {
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.href = `api/${nextPage}.json`;
            document.head.appendChild(link);
        });
    }
}

function initKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && DOM.modal.style.display !== 'none') {
            closeModal();
        }
        
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            const sliders = document.querySelectorAll('.content-slider'); 
            sliders.forEach(slider => {
                if (isElementInViewport(slider)) {
                    slideContent(slider.parentElement.querySelector('.slider-controls'), 
                        e.key === 'ArrowLeft' ? -1 : 1);
                }
            });
        }
    });
}

// Add to the top of script.js after other constants
const WATCHLIST_KEY = 'hexa_watchlist';

function getWatchlist() {
    const watchlist = localStorage.getItem(WATCHLIST_KEY);
    return watchlist ? JSON.parse(watchlist) : [];
}

function addToWatchlist(item) {
    const watchlist = getWatchlist();
    if (!watchlist.some(i => i.id === item.id)) {
        const watchlistItem = {
            id: item.id,
            title: item.title || item.name,
            poster_path: item.poster_path,
            media_type: item.media_type || (item.first_air_date ? 'tv' : 'movie'),
            added_date: Date.now(),
            overview: item.overview,
            vote_average: item.vote_average
        };
        
        watchlist.push(watchlistItem);
        localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
        showToast('Added to watchlist');
        
        // Update button state
        const watchlistBtn = document.querySelector(`[data-id="${item.id}"] .watchlist-btn`);
        if (watchlistBtn) {
            watchlistBtn.classList.add('active');
            watchlistBtn.innerHTML = '<span>✓</span>';
        }
    }
}

function removeFromWatchlist(id) {
    const watchlist = getWatchlist();
    const updatedWatchlist = watchlist.filter(item => item.id !== id);
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(updatedWatchlist));
    showToast('Removed from watchlist');
    
    // Update UI
    if (currentSection === 'watchlist') {
        loadWatchlistContent();
    } else {
        // Update button state
        const watchlistBtn = document.querySelector(`[data-id="${id}"] .watchlist-btn`);
        if (watchlistBtn) {
            watchlistBtn.classList.remove('active');
            watchlistBtn.innerHTML = '<span>+</span>';
        }
    }
}

function isInWatchlist(id) {
    const watchlist = getWatchlist();
    return watchlist.some(item => item.id === id);
}

async function loadWatchlistContent() {
    currentSection = 'watchlist';
    const watchlist = getWatchlist();
    
    DOM.mainContent.innerHTML = `
        <div class="page-content">
            <div class="page-header">
                <h1>My Watchlist</h1>
            </div>
            <div class="content-grid">
                ${watchlist.length === 0 ? `
                    <div class="empty-results">
                        Your watchlist is empty. Add some movies or shows!
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    if (watchlist.length > 0) {
        const contentGrid = DOM.mainContent.querySelector('.content-grid');
        
        // Fetch full details for each watchlist item
        const items = await Promise.all(
            watchlist.map(async (item) => {
                try {
                    const response = await fetch(
                        `${BASE_URL}/${item.media_type}/${item.id}?api_key=${API_KEY}`
                    );
                    const fullDetails = await response.json();
                    return {
                        ...fullDetails,
                        media_type: item.media_type
                    };
                } catch (error) {
                    console.error('Error fetching item details:', error);
                    return item; // Fallback to stored data if fetch fails
                }
            })
        );

        items.forEach(item => {
            const element = createContentCard(item);
            contentGrid.appendChild(element);
        });
    }
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    
    const container = document.querySelector('.toast-container');
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function createFilterSection(mediaType) {
    return `
        <div class="filter-section">
            <select id="year-filter" class="filter-select">
                <option value="">All Years</option>
                ${generateYearOptions()}
            </select>
            <select id="rating-filter" class="filter-select">
                <option value="">All Ratings</option>
                <option value="7">7+ Rating</option>
                <option value="8">8+ Rating</option>
                <option value="9">9+ Rating</option>
            </select>
            <select id="sort-filter" class="filter-select">
                <option value="popularity.desc">Popularity</option>
                <option value="vote_average.desc">Rating</option>
                <option value="release_date.desc">Release Date</option>
            </select>
        </div>
    `;
}

function generateYearOptions() {
    const currentYear = new Date().getFullYear();
    let options = '';
    for (let year = currentYear; year >= 1900; year--) {
        options += `<option value="${year}">${year}</option>`;
    }
    return options;
}

async function applyFilters(mediaType) {
    const year = document.getElementById('year-filter').value;
    const rating = document.getElementById('rating-filter').value;
    const sort = document.getElementById('sort-filter').value;
    
    let url = `${BASE_URL}/discover/${mediaType}?api_key=${API_KEY}&page=${currentPage}`;
    
    if (year) url += `&primary_release_year=${year}`;
    if (rating) url += `&vote_average.gte=${rating}`;
    if (sort) url += `&sort_by=${sort}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        return data.results;
    } catch (error) {
        console.error('Error applying filters:', error);
        return [];
    }
}

async function loadGenreBasedRecommendations() {
    const watchHistory = JSON.parse(localStorage.getItem('vidLinkProgress') || '{}');
    if (Object.keys(watchHistory).length === 0) return '';

    // Extract genres from watch history
    const genres = new Map();
    Object.values(watchHistory).forEach(item => {
        item.genres?.forEach(genre => {
            genres.set(genre.id, (genres.get(genre.id) || 0) + 1);
        });
    });

    // Get top genre
    const topGenre = Array.from(genres.entries())
        .sort((a, b) => b[1] - a[1])[0];

    if (!topGenre) return '';

    try {
        const response = await fetch(
            `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=${topGenre[0]}&sort_by=popularity.desc`
        );
        const data = await response.json();

        return `
            <div class="content-row">
                <h2>More Like What You Watch</h2>
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
        console.error('Error loading genre recommendations:', error);
        return '';
    }
}

async function loadWatchTimeBasedContent() {
    const watchHistory = JSON.parse(localStorage.getItem('vidLinkProgress') || '{}');
    const watchTimes = Object.values(watchHistory).map(item => new Date(item.last_updated));
    
    // Analyze watch times to determine peak viewing hours
    const hours = watchTimes.map(time => time.getHours());
    const avgHour = Math.round(hours.reduce((a, b) => a + b, 0) / hours.length);
    
    let timeSlot = 'evening';
    if (avgHour < 12) timeSlot = 'morning';
    else if (avgHour < 17) timeSlot = 'afternoon';
    else if (avgHour < 20) timeSlot = 'evening';
    else timeSlot = 'night';

    try {
        const response = await fetch(
            `${BASE_URL}/discover/movie?api_key=${API_KEY}&sort_by=vote_average.desc&vote_count.gte=1000`
        );
        const data = await response.json();

        return `
            <div class="content-row">
                <h2>Perfect for ${timeSlot} viewing</h2>
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
        console.error('Error loading time-based content:', error);
        return '';
    }
}

async function loadPopularInRegion() {
    try {
        const region = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const country = region.split('/')[0];
        
        const response = await fetch(
            `${BASE_URL}/discover/movie?api_key=${API_KEY}&region=${country}&sort_by=popularity.desc`
        );
        const data = await response.json();

        return `
            <div class="content-row">
                <h2>Popular in Your Region</h2>
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
        console.error('Error loading regional content:', error);
        return '';
    }
}

async function init() {
    try {
        document.querySelector('header').style.display = 'block';
        await loadContent();
    } catch (error) {
        console.error('Error initializing app:', error);
    }
}
