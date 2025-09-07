import React, { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import './SimpleMovies.css'
import Navbar from '../../components/Navbar/Navbar'
import Footer from '../../components/Footer/Footer'
import MovieDetailsPanel from '../../components/MovieDetailsPanel/MovieDetailsPanel'
import { fetchLatestMoviesV3, fetchMovieDetailBySlug, searchMovies, buildPhimApiImageUrl } from '../../services/phimapi'
import { fetchTmdbById, buildTmdbImagePath } from '../../services/tmdb'

const SimpleMovies = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  
  // Get params from URL
  const page = parseInt(searchParams.get('page')) || 1
  const keyword = searchParams.get('keyword') || ''
  
  // States
  const [movies, setMovies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  
  // Movie details panel
  const [selectedMovie, setSelectedMovie] = useState(null)
  const [movieDetail, setMovieDetail] = useState(null)
  const [showDetails, setShowDetails] = useState(false)
  const [, setDetailLoading] = useState(false)
  
  // Search states
  const [searchKeyword, setSearchKeyword] = useState(keyword)
  const [allSearchResults, setAllSearchResults] = useState([]) // Store all search results
  const [isSearchMode, setIsSearchMode] = useState(!!keyword)
  
  // Page title
  const pageTitle = keyword ? `Tìm kiếm: "${keyword}"` : 'Tất cả phim'
  
  // Advanced search with multiple strategies
  const searchMultiplePages = async (searchKeyword, maxPages = 30) => {
    const allMovies = []
    
    // Strategy 1: Direct keyword search across multiple pages
    const directSearchPromises = []
    for (let page = 1; page <= maxPages; page++) {
      directSearchPromises.push(
        searchMovies({ 
          keyword: searchKeyword.trim(), 
          page, 
          limit: 64,
          sort_field: 'modified.time',
          sort_type: 'desc'
        }).catch(() => ({ items: [] }))
      )
    }
    
    const directResults = await Promise.allSettled(directSearchPromises)
    directResults.forEach((result) => {
      if (result.status === 'fulfilled' && result.value?.items) {
        allMovies.push(...result.value.items)
      }
    })
    
    // Strategy 2: Split keyword and search each word
    const words = searchKeyword.trim().split(/\s+/).filter(word => word.length > 2)
    if (words.length > 1) {
      for (const word of words) {
        const wordSearchPromises = []
        for (let page = 1; page <= Math.min(10, maxPages); page++) {
          wordSearchPromises.push(
            searchMovies({ 
              keyword: word, 
              page, 
              limit: 64,
              sort_field: 'modified.time',
              sort_type: 'desc'
            }).catch(() => ({ items: [] }))
          )
        }
        
        const wordResults = await Promise.allSettled(wordSearchPromises)
        wordResults.forEach((result) => {
          if (result.status === 'fulfilled' && result.value?.items) {
            allMovies.push(...result.value.items)
          }
        })
      }
    }
    
    // Strategy 3: Alternative search terms for Vietnamese
    const vietnameseAlternatives = {
      'sát thủ': ['killer', 'assassin', 'hitman', 'sat thu', 'sat', 'thu', 'john wick', 'agent'],
      'sat thu': ['killer', 'assassin', 'hitman', 'sát thủ', 'sat', 'thu', 'john wick', 'agent'],
      'ma lai': ['zombie', 'undead', 'walking dead', 'ma', 'lai'],
      'siêu anh hùng': ['superhero', 'hero', 'marvel', 'dc', 'superman', 'batman', 'avengers'],
      'kinh dị': ['horror', 'scary', 'terror', 'kinh', 'di'],
      'hành động': ['action', 'fight', 'hanh dong'],
      'tình cảm': ['romance', 'love', 'tinh cam'],
      'hài hước': ['comedy', 'funny', 'hai huoc'],
      'phiêu lưu': ['adventure', 'phieu luu'],
      'khoa học viễn tưởng': ['sci-fi', 'science fiction', 'khoa hoc vien tuong'],
      'chiến tranh': ['war', 'chien tranh'],
      'gia đình': ['family', 'gia dinh'],
      'tội phạm': ['crime', 'criminal', 'toi pham']
    }
    
          const alternatives = vietnameseAlternatives[searchKeyword.toLowerCase()] || []
      if (alternatives.length > 0) {
        for (const alt of alternatives) {
        const altSearchPromises = []
        for (let page = 1; page <= Math.min(5, maxPages); page++) {
          altSearchPromises.push(
            searchMovies({ 
              keyword: alt, 
              page, 
              limit: 64,
              sort_field: 'modified.time',
              sort_type: 'desc'
            }).catch(() => ({ items: [] }))
          )
        }
        
        const altResults = await Promise.allSettled(altSearchPromises)
        altResults.forEach((result) => {
          if (result.status === 'fulfilled' && result.value?.items) {
            allMovies.push(...result.value.items)
          }
        })
      }
    }
    
    // Strategy 4: If no results, search in latest movies and filter locally
    if (allMovies.length === 0) {
      
      try {
        // Get latest movies from multiple pages
        const latestMoviesPromises = []
        for (let page = 1; page <= 10; page++) {
          latestMoviesPromises.push(
            fetchLatestMoviesV3(page).catch(() => ({ items: [] }))
          )
        }
        
        const latestResults = await Promise.allSettled(latestMoviesPromises)
        const latestMovies = []
        
        latestResults.forEach((result) => {
          if (result.status === 'fulfilled' && result.value?.items) {
            latestMovies.push(...result.value.items)
          }
        })
        
        // Local search/filter
        const searchTerms = [
          searchKeyword.toLowerCase(),
          ...words.map(w => w.toLowerCase()),
          ...alternatives.map(a => a.toLowerCase())
        ]
        
        const localMatches = latestMovies.filter(movie => {
          const title = (movie.name || movie.origin_name || '').toLowerCase()
          const content = (movie.content || '').toLowerCase()
          
          return searchTerms.some(term => 
            title.includes(term) || content.includes(term)
          )
        })
        
        allMovies.push(...localMatches)
        
      } catch (error) {
        console.error('Strategy 4 failed:', error)
      }
    }
    
    // Remove duplicates based on slug
    const uniqueMovies = allMovies.filter((movie, index, self) => 
      index === self.findIndex(m => m.slug === movie.slug)
    )
    
    // Filter and rank by relevance
    const rankedMovies = uniqueMovies.map(movie => ({
      ...movie,
      relevanceScore: calculateRelevance(movie, searchKeyword, words, alternatives)
    })).sort((a, b) => b.relevanceScore - a.relevanceScore)
    
    return rankedMovies
  }
  
  // Calculate relevance score for ranking
  const calculateRelevance = (movie, originalKeyword, words, alternatives) => {
    let score = 0
    const title = (movie.name || movie.origin_name || '').toLowerCase()
    const content = (movie.content || '').toLowerCase()
    const originalLower = originalKeyword.toLowerCase()
    
    // Exact match in title gets highest score
    if (title.includes(originalLower)) score += 100
    
    // Partial matches in title
    words.forEach(word => {
      if (title.includes(word.toLowerCase())) score += 50
    })
    
    // Alternative matches
    alternatives.forEach(alt => {
      if (title.includes(alt.toLowerCase())) score += 30
    })
    
    // Content matches
    if (content.includes(originalLower)) score += 20
    words.forEach(word => {
      if (content.includes(word.toLowerCase())) score += 10
    })
    
    // Year bonus (newer movies get slight preference)
    if (movie.year && movie.year > 2020) score += 5
    if (movie.year && movie.year > 2015) score += 2
    
    return score
  }

  // Load movies function
  const loadMovies = async (pageNum, searchKeyword = '') => {
    try {
      setLoading(true)
      setError('')
      
      let movieList = []
      const itemsPerPage = 64
      
      if (searchKeyword.trim()) {
        setIsSearchMode(true)
        
        // Check if we already have search results
        if (allSearchResults.length === 0 || allSearchResults[0]?.searchKeyword !== searchKeyword.trim()) {
          // Perform comprehensive search across multiple pages
          const searchResults = await searchMultiplePages(searchKeyword.trim())
          
          // Store search results with metadata
          const resultsWithMetadata = searchResults.map(movie => ({
            ...movie,
            searchKeyword: searchKeyword.trim()
          }))
          
          setAllSearchResults(resultsWithMetadata)
          
          // Calculate pagination for search results
          const totalSearchResults = resultsWithMetadata.length
          const searchTotalPages = Math.ceil(totalSearchResults / itemsPerPage)
          setTotalPages(Math.max(1, searchTotalPages))
          setTotalItems(totalSearchResults)
          
          // Get movies for current page
          const startIndex = (pageNum - 1) * itemsPerPage
          const endIndex = startIndex + itemsPerPage
          movieList = resultsWithMetadata.slice(startIndex, endIndex)
          
        } else {
          // Use cached search results
          const startIndex = (pageNum - 1) * itemsPerPage
          const endIndex = startIndex + itemsPerPage
          movieList = allSearchResults.slice(startIndex, endIndex)
          
          // Update pagination
          const totalSearchResults = allSearchResults.length
          const searchTotalPages = Math.ceil(totalSearchResults / itemsPerPage)
          setTotalPages(Math.max(1, searchTotalPages))
          setTotalItems(totalSearchResults)
        }
      } else {
        setIsSearchMode(false)
        setAllSearchResults([]) // Clear search results
        
        // Fetch data from latest movies API (all movies)
        const data = await fetchLatestMoviesV3(pageNum)
        
        // Extract movies and pagination info
        movieList = Array.isArray(data?.items || data?.data) ? (data.items || data.data) : []
        
        // Set pagination info
        if (data?.pagination) {
          setTotalPages(data.pagination.totalPages || 1)
          setTotalItems(data.pagination.totalItems || movieList.length)
        } else {
          // Fallback if no pagination info
          setTotalPages(Math.max(1, pageNum))
          setTotalItems(movieList.length)
        }
      }
      
      // Enrich with TMDB data
      const enrichedMovies = await Promise.all(movieList.map(async (movie) => {
        const tmdbId = movie?.tmdb?.id
        const mediaType = movie?.type === 'series' ? 'tv' : 'movie'
        
        try {
          if (tmdbId) {
            const tmdb = await fetchTmdbById(tmdbId, mediaType)
            return {
              ...movie,
              _tmdb: tmdb,
              _poster: buildTmdbImagePath(tmdb?.poster_path, 'w342') || buildPhimApiImageUrl(movie?.poster_url) || buildPhimApiImageUrl(movie?.thumb_url) || '',
              _backdrop: buildTmdbImagePath(tmdb?.backdrop_path, 'w780') || buildPhimApiImageUrl(movie?.thumb_url) || buildPhimApiImageUrl(movie?.poster_url) || '',
            }
          } else {
            // No TMDB, use original data
            return {
              ...movie,
              _tmdb: null,
              _poster: buildPhimApiImageUrl(movie?.poster_url) || buildPhimApiImageUrl(movie?.thumb_url) || '',
              _backdrop: buildPhimApiImageUrl(movie?.thumb_url) || buildPhimApiImageUrl(movie?.poster_url) || '',
            }
          }
        } catch (e) {
          console.error('TMDB fetch error for', tmdbId, e)
          return {
            ...movie,
            _tmdb: null,
            _poster: buildPhimApiImageUrl(movie?.poster_url) || buildPhimApiImageUrl(movie?.thumb_url) || '',
            _backdrop: buildPhimApiImageUrl(movie?.thumb_url) || buildPhimApiImageUrl(movie?.poster_url) || '',
          }
        }
      }))
      
      setMovies(enrichedMovies)
      
    } catch (e) {
      console.error('Load movies error:', e)
      setError(e?.message || 'Không thể tải danh sách phim')
    } finally {
      setLoading(false)
    }
  }

  // Load movies when page or keyword changes
  useEffect(() => {
    loadMovies(page, keyword)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, keyword])
  
  // Update search keyword state when URL changes
  useEffect(() => {
    setSearchKeyword(keyword)
    setIsSearchMode(!!keyword)
    // Clear search results if keyword changes
    if (!keyword) {
      setAllSearchResults([])
    }
  }, [keyword])

  // Handle page change
  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return
    
    const params = { page: newPage.toString() }
    if (keyword) params.keyword = keyword
    
    setSearchParams(params)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  
  // Handle search
  const handleSearch = () => {
    if (searchKeyword.trim() === keyword) return
    
    const params = { page: '1' }
    if (searchKeyword.trim()) {
      params.keyword = searchKeyword.trim()
    }
    
    setSearchParams(params)
  }
  
  // Handle search input change
  const handleSearchInputChange = (e) => {
    setSearchKeyword(e.target.value)
  }
  
  // Handle search on Enter key
  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }
  
  // Clear search
  const clearSearch = () => {
    setSearchKeyword('')
    setSearchParams({ page: '1' })
  }

  // Handle movie click
  const handleMovieClick = async (movie) => {
    setSelectedMovie(movie)
    setMovieDetail(null)
    setShowDetails(true)
    
    if (!movie?.slug) return
    
    try {
      setDetailLoading(true)
      const detail = await fetchMovieDetailBySlug(movie.slug)
      setMovieDetail(detail)
    } catch (e) {
      console.error('Error fetching movie details:', e)
    } finally {
      setDetailLoading(false)
    }
  }

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const delta = 2 // Show 2 pages before and after current
    const range = []
    const rangeWithDots = []

    for (let i = Math.max(2, page - delta); i <= Math.min(totalPages - 1, page + delta); i++) {
      range.push(i)
    }

    if (page - delta > 2) {
      rangeWithDots.push(1, '...')
    } else {
      rangeWithDots.push(1)
    }

    rangeWithDots.push(...range)

    if (page + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages)
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages)
    }

    return rangeWithDots
  }

  return (
    <div className='simple-movies-page'>
      <Navbar />
      
      <div className='simple-movies-container'>
        {/* Header */}
        <div className='movies-header'>
          <button onClick={() => navigate('/')} className='back-btn'>
            ← Trang chủ
          </button>
          <h1>{pageTitle}</h1>
          <p>Trang {page} / {totalPages} • {totalItems.toLocaleString()} phim</p>
        </div>

        {/* Search Bar */}
        <div className='search-bar-container'>
          <div className='search-bar'>
            <input 
              type='text'
              placeholder='Tìm kiếm phim theo tên, diễn viên, đạo diễn...' 
              value={searchKeyword} 
              onChange={handleSearchInputChange}
              onKeyPress={handleSearchKeyPress}
              className='search-input'
            />
            {searchKeyword && (
              <button className='search-clear' onClick={clearSearch}>
                ✕
              </button>
            )}
            <button className='search-btn' onClick={handleSearch}>
               Tìm kiếm
            </button>
          </div>
          
          {keyword && (
            <div className='search-info'>
              <span>Kết quả tìm kiếm cho: "<strong>{keyword}</strong>"</span>
              <button className='clear-search-link' onClick={clearSearch}>
                Xem tất cả phim
              </button>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && <div className='error-message'>{error}</div>}

        {/* Loading State */}
        {loading ? (
          <div className='loading-container'>
            {isSearchMode && keyword ? (
              <div className='search-loading'>
                <div className='loading-spinner'></div>
                <p>Đang tìm kiếm "{keyword}"  toàn bộ ..</p>
                <p className='loading-subtitle'>Đang Tìm kiếm...</p>
                <div className='search-strategies'>
                  <div>✓ Tìm kiếm trực tiếp</div>
                  <div>✓ Tìm từng từ riêng lẻ</div>
                  <div>✓ Tìm từ đồng nghĩa</div>
                  <div>✓ Tìm trong phim mới nhất</div>
                </div>
              </div>
            ) : (
              <div className='loading-grid'>
                {Array.from({length: 20}).map((_, i) => (
                  <div key={i} className='movie-card-skeleton'></div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Movies Grid */}
            <div className='movies-grid'>
              {movies.map((movie, index) => (
                <div 
                  key={movie.slug ? `movie-${movie.slug}` : `movie-index-${index}`} 
                  className='movie-card'
                  onClick={() => handleMovieClick(movie)}
                >
                  <div className='movie-poster'>
                    <img 
                      src={movie?._poster || movie?._backdrop || ''} 
                      alt={movie?.name || movie?.origin_name || 'movie'} 
                      loading='lazy'
                    />
                    <div className='movie-overlay'>
                      <div className='movie-info'>
                        <h3>{movie?.name || movie?.origin_name}</h3>
                        <p>{movie?.year || movie?._tmdb?.release_date?.split('-')[0]}</p>
                        {movie?.quality && <span className='quality'>{movie.quality}</span>}
                      </div>
                      <button className='play-btn'>▶</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* No Results */}
            {movies.length === 0 && !loading && (
              <div className='no-results'>
                <p>Không tìm thấy phim nào trong trang này</p>
                <p>Trang: {page}</p>
                <button onClick={() => loadMovies(page, keyword)}>Thử lại</button>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className='pagination'>
                <button 
                  disabled={page <= 1} 
                  onClick={() => handlePageChange(page - 1)}
                  className='pagination-btn'
                >
                  ← Trang trước
                </button>
                
                <div className='page-numbers'>
                  {getPageNumbers().map((pageNum, index) => (
                    pageNum === '...' ? (
                      <span key={`dots-${index}`} className='dots'>...</span>
                    ) : (
                      <button
                        key={`page-${pageNum}`}
                        className={`page-btn ${pageNum === page ? 'active' : ''}`}
                        onClick={() => handlePageChange(pageNum)}
                      >
                        {pageNum}
                      </button>
                    )
                  ))}
                </div>
                
                <button 
                  disabled={page >= totalPages} 
                  onClick={() => handlePageChange(page + 1)}
                  className='pagination-btn'
                >
                  Trang sau →
                </button>
              </div>
            )}
          </>
        )}
      </div>
      
      <Footer />
      
      {/* Movie Details Panel */}
      <MovieDetailsPanel 
        open={showDetails} 
        onClose={() => setShowDetails(false)} 
        movie={selectedMovie} 
        detail={movieDetail} 
      />
    </div>
  )
}

export default SimpleMovies
