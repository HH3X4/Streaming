const API_KEY = '8908a80d66eae13bd34f357ec5bc1db8';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/w500';

function App() {
  const [movies, setMovies] = React.useState([]);
  const [tvShows, setTvShows] = React.useState([]);
  const [searchResults, setSearchResults] = React.useState([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [myList, setMyList] = React.useState([]);
  const [continueWatching, setContinueWatching] = React.useState([]);

  React.useEffect(() => {
    getPopularMovies();
    getPopularTVShows();
    const savedMyList = localStorage.getItem('myList');
    if (savedMyList) {
      setMyList(JSON.parse(savedMyList));
    }
    const savedContinueWatching = localStorage.getItem('continueWatching');
    if (savedContinueWatching) {
      setContinueWatching(JSON.parse(savedContinueWatching));
    }
  }, []);

  async function getPopularMovies() {
    const res = await fetch(`${BASE_URL}/movie/popular?api_key=${API_KEY}`);
    const data = await res.json();
    setMovies(data.results);
  }

  async function getPopularTVShows() {
    const res = await fetch(`${BASE_URL}/tv/popular?api_key=${API_KEY}`);
    const data = await res.json();
    setTvShows(data.results);
  }

  async function handleSearch(e) {
    const query = e.target.value;
    setSearchQuery(query);
    if (query) {
      const res = await fetch(`${BASE_URL}/search/multi?api_key=${API_KEY}&query=${query}`);
      const data = await res.json();
      setSearchResults(data.results);
    } else {
      setSearchResults([]);
    }
  }

  function addToMyList(item) {
    const updatedList = [...myList, item];
    setMyList(updatedList);
    localStorage.setItem('myList', JSON.stringify(updatedList));
  }

  function removeFromMyList(item) {
    const updatedList = myList.filter(listItem => listItem.id !== item.id);
    setMyList(updatedList);
    localStorage.setItem('myList', JSON.stringify(updatedList));
  }

  function addToContinueWatching(item) {
    const updatedList = [item, ...continueWatching.filter(i => i.id !== item.id)].slice(0, 10);
    setContinueWatching(updatedList);
    localStorage.setItem('continueWatching', JSON.stringify(updatedList));
  }

  async function getRecommendations(type, id) {
    const res = await fetch(`${BASE_URL}/${type}/${id}/recommendations?api_key=${API_KEY}`);
    const data = await res.json();
    return data.results.slice(0, 5);
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Header searchQuery={searchQuery} handleSearch={handleSearch} />
      <main className="container mx-auto px-4 py-8">
        {searchQuery ? (
          <SearchResults results={searchResults} />
        ) : (
          <React.Fragment>
            {continueWatching.length > 0 && (
              <ContentSection title="Continue Watching" items={continueWatching} type="continue" addToMyList={addToMyList} />
            )}
            <MyList items={myList} removeFromMyList={removeFromMyList} />
            <ContentSection title="Popular Movies" items={movies} type="movie" addToMyList={addToMyList} />
            <ContentSection title="Popular TV Shows" items={tvShows} type="tv" addToMyList={addToMyList} />
          </React.Fragment>
        )}
      </main>
      <Footer />
    </div>
  );
}

function Header({ searchQuery, handleSearch }) {
  return (
    <header className="bg-gray-800 py-4 sticky top-0 z-10">
      <div className="container mx-auto px-4 flex justify-between items-center">
        <a href="index.html" className="logo">
          <img src="./images/logo.png" alt="Hexa Logo" className="h-10" />
        </a>
        <input
          type="text"
          placeholder="Search for movies or TV shows..."
          className="search-bar w-1/3 px-4 py-2 rounded-full bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-300"
          value={searchQuery}
          onChange={handleSearch}
        />
      </div>
    </header>
  );
}

function ContentSection({ title, items, type, addToMyList }) {
  return (
    <section className="content-section mb-12">
      <h2 className="mb-4">{title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {items.map(item => (
          <ContentCard key={item.id} item={item} type={type} addToMyList={addToMyList} />
        ))}
      </div>
    </section>
  );
}

function ContentCard({ item, type, addToMyList }) {
  const [recommendations, setRecommendations] = React.useState([]);

  const handleMouseEnter = async () => {
    if (recommendations.length === 0) {
      const recs = await getRecommendations(type, item.id);
      setRecommendations(recs);
    }
  };

  const title = type === 'movie' ? item.title : item.name;
  return (
    <div className="content-card bg-gray-800 rounded-lg overflow-hidden shadow-lg" onMouseEnter={handleMouseEnter}>
      <img src={IMG_URL + item.poster_path} alt={title} className="w-full h-auto" />
      <div className="p-4">
        <h3 className="font-semibold text-lg mb-2 truncate">{title}</h3>
        <div className="flex justify-between items-center">
          <a href={`pages/${type}.html?id=${item.id}`} className="btn inline-block bg-blue-500 text-white px-4 py-2 rounded-full hover:bg-blue-600 transition duration-300">
            Details
          </a>
          <button onClick={() => addToMyList(item)} className="text-white hover:text-blue-300 transition duration-300">
            <i className="fas fa-plus-circle"></i>
          </button>
        </div>
        {recommendations.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-semibold mb-2">You might also like:</h4>
            <ul className="text-xs">
              {recommendations.map(rec => (
                <li key={rec.id} className="mb-1">
                  <a href={`pages/${type}.html?id=${rec.id}`} className="hover:text-blue-300 transition duration-300">
                    {rec.title || rec.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function SearchResults({ results }) {
  return (
    <section className="mb-12">
      <h2 className="text-2xl font-semibold mb-4">Search Results</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {results.map(item => (
          <ContentCard key={item.id} item={item} type={item.media_type} />
        ))}
      </div>
    </section>
  );
}

function MyList({ items, removeFromMyList }) {
  if (items.length === 0) return null;

  return (
    <section className="mb-12">
      <h2 className="text-2xl font-semibold mb-4">My List</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {items.map(item => (
          <div key={item.id} className="bg-gray-800 rounded-lg overflow-hidden shadow-lg transition-transform duration-300 hover:scale-105">
            <img src={IMG_URL + item.poster_path} alt={item.title || item.name} className="w-full h-auto" />
            <div className="p-4">
              <h3 className="font-semibold text-lg mb-2 truncate">{item.title || item.name}</h3>
              <div className="flex justify-between items-center">
                <a href={`pages/${item.media_type}.html?id=${item.id}`} className="inline-block bg-red-600 text-white px-4 py-2 rounded-full hover:bg-red-700 transition duration-300">
                  Details
                </a>
                <button onClick={() => removeFromMyList(item)} className="text-white hover:text-red-600 transition duration-300">
                  <i className="fas fa-minus-circle"></i>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-gray-800 py-8">
      <div className="container mx-auto px-4 text-center">
        <p>&copy; 2024 Hexa. All rights reserved.</p>
      </div>
    </footer>
  );
}

ReactDOM.render(<App />, document.getElementById('root'));
