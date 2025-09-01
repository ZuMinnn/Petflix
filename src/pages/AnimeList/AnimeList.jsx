import React, { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import './AnimeList.css'
import Navbar from '../../components/Navbar/Navbar'
import Footer from '../../components/Footer/Footer'
import MovieDetailsPanel from '../../components/MovieDetailsPanel/MovieDetailsPanel'
import { fetchLatestMoviesV3, fetchMovieDetailBySlug, searchMovies, fetchAnimeMovies, fetchMoviesByCategory, buildPhimApiImageUrl } from '../../services/phimapi'
import { fetchTmdbById, buildTmdbImagePath } from '../../services/tmdb'

const AnimeList = () => {
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
  const [detailLoading, setDetailLoading] = useState(false)
  
  // Search states
  const [searchKeyword, setSearchKeyword] = useState(keyword)
  const [allSearchResults, setAllSearchResults] = useState([]) // Store all search results
  const [isSearchMode, setIsSearchMode] = useState(!!keyword)
  
  // Page title
  const pageTitle = keyword ? `Tìm kiếm anime: "${keyword}"` : 'Anime - Wibu Heaven'
  
  // Helper function to build anime API URL
  const buildAnimeApiUrl = (page = 1, limit = 64, additionalParams = {}) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      sort_field: 'modified.time',
      sort_type: 'desc',
      // Không filter country ở API level, sẽ filter ở client
      ...additionalParams
    })
    
    return `https://phimapi.com/v1/api/danh-sach/hoat-hinh?${params.toString()}`
  }



  // Helper function to get best available image for anime
  const getBestAnimeImage = (anime, tmdb, imageType = 'poster') => {
    let tmdbPath = ''
    let phimApiUrl = ''
    
    if (imageType === 'poster') {
      tmdbPath = buildTmdbImagePath(tmdb?.poster_path, 'w342')
      phimApiUrl = buildPhimApiImageUrl(anime?.poster_url) || buildPhimApiImageUrl(anime?.thumb_url)
    } else {
      tmdbPath = buildTmdbImagePath(tmdb?.backdrop_path, 'w780') 
      phimApiUrl = buildPhimApiImageUrl(anime?.thumb_url) || buildPhimApiImageUrl(anime?.poster_url)
    }
    
    // Improved anime placeholder với gradient và icon
    let animePlaceholder = ''
    if (imageType === 'poster') {
      const animeTitle = encodeURIComponent((anime?.name || anime?.origin_name || 'ANIME').slice(0, 20))
      animePlaceholder = `https://via.placeholder.com/342x513/667eea/ffffff?text=${animeTitle}`
    } else {
      const animeTitle = encodeURIComponent((anime?.name || anime?.origin_name || 'ANIME BACKDROP').slice(0, 15))
      animePlaceholder = `https://via.placeholder.com/780x439/667eea/ffffff?text=${animeTitle}`
    }
    
    return tmdbPath || phimApiUrl || animePlaceholder
  }
  

  
  // Filter function to check if a movie is anime
  const isAnime = (movie) => {
    // Điều kiện 1: type = "hoathinh" (chính thức)
    const isAnimationType = movie?.type === 'hoathinh'
    
    // Điều kiện 2: Có quốc gia Nhật Bản hoặc liên quan đến anime
    const hasAnimeCountry = movie?.country?.some(country => 
      country.name?.toLowerCase().includes('nhật bản') ||
      country.slug?.toLowerCase().includes('nhat-ban') ||
      country.name?.toLowerCase().includes('japan') ||
      country.name?.toLowerCase().includes('hàn quốc') ||  // Manhwa anime
      country.slug?.toLowerCase().includes('han-quoc')
    )
    
    // Điều kiện 3: Tên phim có từ khóa anime
    const animeKeywords = ['anime', 'manga', 'naruto', 'one piece', 'dragon ball', 'attack on titan', 
                          'demon slayer', 'jujutsu kaisen', 'my hero academia', 'pokemon', 'studio ghibli',
                          'bleach', 'hunter x hunter', 'death note', 'fullmetal alchemist', 'evangelion',
                          'cowboy bebop', 'spirited away', 'totoro', 'akira', 'princess mononoke']
    
    const titleLower = (movie?.name || movie?.origin_name || '').toLowerCase()
    const hasAnimeTitle = animeKeywords.some(keyword => titleLower.includes(keyword))
    
    // Điều kiện 4: Category anime-related
    const hasAnimeCategory = movie?.category?.some(cat => 
      cat.name?.toLowerCase().includes('hoạt hình') ||
      cat.slug?.toLowerCase().includes('hoat-hinh') ||
      cat.name?.toLowerCase().includes('anime') ||
      cat.name?.toLowerCase().includes('viễn tưởng') ||
      cat.slug?.toLowerCase().includes('vien-tuong')
    )
    
    // Trả về true nếu có ít nhất 1 trong các điều kiện
    return isAnimationType || 
           (hasAnimeCountry && (hasAnimeTitle || hasAnimeCategory)) ||
           hasAnimeTitle
  }
  
  // Advanced search with multiple strategies for anime only
  const searchMultiplePages = async (searchKeyword, maxPages = 30) => {
    const allMovies = []
    
    // Strategy 1: Search directly in hoat-hinh category with country=nhat-ban (most effective)
    try {
      const animeSearchPromises = []
      for (let page = 1; page <= Math.min(maxPages, 20); page++) {
        animeSearchPromises.push(
          fetch(buildAnimeApiUrl(page, 64))
            .then(res => res.json())
            .catch(() => ({ items: [] }))
        )
      }
      
      const animeResults = await Promise.allSettled(animeSearchPromises)
      animeResults.forEach((result) => {
        if (result.status === 'fulfilled' && result.value?.items) {
          // Filter by search keyword
          const filteredAnime = result.value.items.filter(movie => {
            const title = (movie?.name || movie?.origin_name || '').toLowerCase()
            const content = (movie?.content || '').toLowerCase()
            const searchLower = searchKeyword.toLowerCase()
            
            return title.includes(searchLower) || content.includes(searchLower)
          })
          allMovies.push(...filteredAnime)
        }
      })
    } catch (e) {
      // Silent fail for hoat-hinh search
    }
    
    // Strategy 2: Regular keyword search and filter for anime
    const directSearchPromises = []
    for (let page = 1; page <= Math.min(maxPages, 15); page++) {
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
    directResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value?.items) {
        // Filter only anime movies
        const animeMovies = result.value.items.filter(isAnime)
        allMovies.push(...animeMovies)
      }
    })
    
    // Strategy 3: Split keyword and search each word
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
        wordResults.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value?.items) {
            // Filter only anime movies
            const animeMovies = result.value.items.filter(isAnime)
            allMovies.push(...animeMovies)
          }
        })
      }
    }
    
    // Strategy 4: Alternative search terms for anime
    const animeAlternatives = {
      'anime': ['hoathinh', 'hoạt hình', 'nhật bản', 'japan', 'manga', 'otaku'],
      'hoạt hình': ['anime', 'manga', 'nhật bản', 'japan'],
      'manga': ['anime', 'hoạt hình', 'nhật bản'],
      'one piece': ['luffy', 'zoro', 'sanji', 'nami'],
      'naruto': ['hokage', 'ninja', 'sasuke', 'sakura'],
      'dragon ball': ['goku', 'vegeta', 'saiyan'],
      'attack on titan': ['titan', 'eren', 'mikasa', 'levi'],
      'demon slayer': ['tanjiro', 'nezuko', 'inosuke'],
      'studio ghibli': ['spirited away', 'totoro', 'howl'],
      'pokemon': ['pikachu', 'ash', 'pokeball'],
      'jujutsu kaisen': ['yuji', 'gojo', 'sukuna'],
      'my hero academia': ['deku', 'bakugo', 'allmight']
    }
    
    const alternatives = animeAlternatives[searchKeyword.toLowerCase()] || []
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
        altResults.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value?.items) {
            // Filter only anime movies
            const animeMovies = result.value.items.filter(isAnime)
            allMovies.push(...animeMovies)
          }
        })
      }
    }
    
    // Strategy 5: If no results, search in latest movies and filter locally for anime
    if (allMovies.length === 0) {
      try {
        // Get latest movies from multiple pages
        const latestMoviesPromises = []
        for (let page = 1; page <= 20; page++) {
          latestMoviesPromises.push(
            fetchLatestMoviesV3(page).catch(() => ({ items: [] }))
          )
        }
        
        const latestResults = await Promise.allSettled(latestMoviesPromises)
        const latestMovies = []
        
        latestResults.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value?.items) {
            // Filter only anime movies first
            const animeMovies = result.value.items.filter(isAnime)
            latestMovies.push(...animeMovies)
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
        // Silent fail for strategy 4
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
    
    // Year bonus (newer anime get slight preference)
    if (movie.year && movie.year > 2020) score += 5
    if (movie.year && movie.year > 2015) score += 2
    
    return score
  }

  // Load movies function - only anime using official hoat-hinh endpoint
  const loadMovies = async (pageNum, searchKeyword = '') => {
    try {
      setLoading(true)
      setError('')
      
      // Basic validation
      if (pageNum < 1) {
        navigate('/anime-list?page=1')
        return
      }
      
      let movieList = []
      const itemsPerPage = 64
      
      if (searchKeyword.trim()) {
        setIsSearchMode(true)
        
        // Check if we already have search results
        if (allSearchResults.length === 0 || allSearchResults[0]?.searchKeyword !== searchKeyword.trim()) {
          // Perform comprehensive search across multiple pages for anime only
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
          
          // Enrich new search results with TMDB
          const enrichedNewSearchResults = await Promise.all(movieList.map(async (anime) => {
            const tmdbId = anime?.tmdb?.id
            // Improved media type detection for anime
            let mediaType = 'movie' // default
            if (anime?.type === 'series' || anime?.type === 'hoathinh' || anime?.episode_total > 1) {
              mediaType = 'tv'
            }
            
            try {
              if (tmdbId) {
                const tmdb = await fetchTmdbById(tmdbId, mediaType)
                
                return {
                  ...anime,
                  _tmdb: tmdb,
                  _poster: getBestAnimeImage(anime, tmdb, 'poster'),
                  _backdrop: getBestAnimeImage(anime, tmdb, 'backdrop'),
                }
              } else {
                return {
                  ...anime,
                  _tmdb: null,
                  _poster: getBestAnimeImage(anime, null, 'poster'),
                  _backdrop: getBestAnimeImage(anime, null, 'backdrop'),
                }
              }
            } catch (e) {
              return {
                ...anime,
                _tmdb: null,
                _poster: getBestAnimeImage(anime, null, 'poster'),
                _backdrop: getBestAnimeImage(anime, null, 'backdrop'),
              }
            }
          }))
          
          setMovies(enrichedNewSearchResults)
          return // Exit early for new search results
          
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
          
          // Enrich search results with TMDB
          const enrichedSearchResults = await Promise.all(movieList.map(async (anime) => {
            const tmdbId = anime?.tmdb?.id
            // Improved media type detection for anime
            let mediaType = 'movie' // default
            if (anime?.type === 'series' || anime?.type === 'hoathinh' || anime?.episode_total > 1) {
              mediaType = 'tv'
            }
            
            try {
              if (tmdbId) {
                const tmdb = await fetchTmdbById(tmdbId, mediaType)
                
                return {
                  ...anime,
                  _tmdb: tmdb,
                  _poster: getBestAnimeImage(anime, tmdb, 'poster'),
                  _backdrop: getBestAnimeImage(anime, tmdb, 'backdrop'),
                }
              } else {
                return {
                  ...anime,
                  _tmdb: null,
                  _poster: getBestAnimeImage(anime, null, 'poster'),
                  _backdrop: getBestAnimeImage(anime, null, 'backdrop'),
                }
              }
            } catch (e) {
              return {
                ...anime,
                _tmdb: null,
                _poster: getBestAnimeImage(anime, null, 'poster'),
                _backdrop: getBestAnimeImage(anime, null, 'backdrop'),
              }
            }
          }))
          
          setMovies(enrichedSearchResults)
          return // Exit early for search mode
        }
      } else {
        setIsSearchMode(false)
        setAllSearchResults([]) // Clear search results
        
        // Sử dụng API hoat-hinh với country=nhat-ban để lấy anime Nhật Bản
        try {
          // Thử nhiều cách gọi API khác nhau
          let data = null
          let url = ''
          
          // Method 1: API với country=nhat-ban (ưu tiên cho trang 1)
          try {
            url = buildAnimeApiUrl(pageNum, itemsPerPage)
            
            const response = await fetch(url)
            
            if (response.ok) {
              data = await response.json()
            } else {
              throw new Error(`API response not ok: ${response.status}`)
            }
          } catch (apiError) {
            
            // Method 2: API mà không có country filter (fallback)
            try {
              const params = new URLSearchParams({
                page: pageNum.toString(),
                limit: itemsPerPage.toString(),
                sort_field: 'modified.time',
                sort_type: 'desc'
              })
              
              url = `https://phimapi.com/v1/api/danh-sach/hoat-hinh?${params.toString()}`
              
              const fallbackResponse = await fetch(url)
              if (fallbackResponse.ok) {
                data = await fallbackResponse.json()
              } else {
                throw new Error(`Fallback API failed: ${fallbackResponse.status}`)
              }
            } catch (fallbackError) {
              
              // Method 3: Try without country filter but for multiple pages if needed
              if (pageNum > 1) {
                const allAnimePages = []
                
                // Fetch multiple pages and find anime for current page
                for (let p = 1; p <= pageNum; p++) {
                  try {
                    const multiPageParams = new URLSearchParams({
                      page: p.toString(),
                      limit: itemsPerPage.toString(),
                      sort_field: 'modified.time',
                      sort_type: 'desc'
                    })
                    
                    const multiPageUrl = `https://phimapi.com/v1/api/danh-sach/hoat-hinh?${multiPageParams.toString()}`
                    const multiPageResponse = await fetch(multiPageUrl)
                    
                    if (multiPageResponse.ok) {
                      const multiPageData = await multiPageResponse.json()
                      const pageMovies = multiPageData?.data?.items || []
                      
                      // Filter for Japanese anime
                      const japaneseAnime = pageMovies.filter(movie => {
                        const hasJapan = movie?.country?.some(country => 
                          country.name?.toLowerCase().includes('nhật bản') ||
                          country.slug?.toLowerCase().includes('nhat-ban') ||
                          country.name?.toLowerCase().includes('japan')
                        )
                        return !movie?.country || movie.country.length === 0 || hasJapan
                      })
                      
                      allAnimePages.push(...japaneseAnime)
                    }
                  } catch (multiError) {
                    // Silent fail for individual pages
                  }
                }
                
                // Create artificial data structure
                data = {
                  status: true,
                  data: {
                    items: allAnimePages
                  }
                }
              } else {
                throw new Error('All API methods failed')
              }
            }
          }
          
          // Extract movies and pagination info - check different data structures
          let extractedMovies = []
          if (data?.data?.items && Array.isArray(data.data.items)) {
            extractedMovies = data.data.items
          } else if (data?.items && Array.isArray(data.items)) {
            extractedMovies = data.items
          } else if (data?.data && Array.isArray(data.data)) {
            extractedMovies = data.data
          } else if (data?.data?.data && Array.isArray(data.data.data)) {
            extractedMovies = data.data.data
          }
          
          movieList = extractedMovies
          
          // First, always filter for Asian anime (expanded criteria)
          if (movieList.length > 0) {
            const asianAnime = movieList.filter(movie => {
              // Japanese anime (primary)
              const hasJapan = movie?.country?.some(country => 
                country.name?.toLowerCase().includes('nhật bản') ||
                country.slug?.toLowerCase().includes('nhat-ban') ||
                country.name?.toLowerCase().includes('japan')
              )
              
              // Korean anime/manhwa
              const hasKorea = movie?.country?.some(country => 
                country.name?.toLowerCase().includes('hàn quốc') ||
                country.slug?.toLowerCase().includes('han-quoc') ||
                country.name?.toLowerCase().includes('korea')
              )
              
              // Chinese anime/donghua
              const hasChina = movie?.country?.some(country => 
                country.name?.toLowerCase().includes('trung quốc') ||
                country.slug?.toLowerCase().includes('trung-quoc') ||
                country.name?.toLowerCase().includes('china')
              )
              
              // Anime keywords
              const animeKeywords = ['anime', 'manga', 'naruto', 'one piece', 'dragon ball', 
                                   'doraemon', 'conan', 'shin-chan', 'luffy', 'goku', 'pikachu']
              const title = (movie?.name || movie?.origin_name || '').toLowerCase()
              const hasAnimeKeywords = animeKeywords.some(keyword => title.includes(keyword))
              
              // Type hoạt hình
              const isAnimeType = movie?.type === 'hoathinh'
              
              return hasJapan || hasKorea || hasChina || hasAnimeKeywords || 
                     isAnimeType || !movie?.country || movie.country.length === 0
            })
            
            movieList = asianAnime
          }
          
          // Simple pagination: sử dụng data từ API call hiện tại
          // Không fetch nhiều trang - chỉ dùng data của trang hiện tại
          
          // Set pagination info cho mọi trang
          let paginationInfo = null
          if (data?.pagination) {
            paginationInfo = data.pagination
          } else if (data?.data?.pagination) {
            paginationInfo = data.data.pagination
          } else if (data?.data?.params) {
            paginationInfo = data.data.params
          }
          
          if (paginationInfo) {
            const totalPages = paginationInfo.totalPages || paginationInfo.total_page || 1
            const totalItems = paginationInfo.totalItems || paginationInfo.total_item || movieList.length
            
            // Sử dụng pagination info từ API, với một số điều chỉnh hợp lý
            if (totalPages === 1 && movieList.length >= itemsPerPage) {
              // Nếu API chỉ trả về 1 trang nhưng có đầy đủ items, estimate nhiều trang hơn
              const estimatedPages = Math.max(50, pageNum + 10) 
              setTotalPages(estimatedPages)
              setTotalItems(estimatedPages * itemsPerPage)
            } else {
              // Sử dụng pagination từ API hoặc minimum reasonable
              setTotalPages(Math.max(totalPages, pageNum))
              setTotalItems(Math.max(totalItems, movieList.length))
            }
          } else {
            // Fallback: Estimate dựa trên trang hiện tại
            let estimatedPages = Math.max(50, pageNum + 10)
            if (movieList.length < itemsPerPage && pageNum > 1) {
              estimatedPages = pageNum
            }
            
            setTotalPages(estimatedPages)
            setTotalItems(estimatedPages * itemsPerPage)
          }
          
          // Enrich anime data with TMDB
          const enrichedAnime = await Promise.all(movieList.map(async (anime) => {
            const tmdbId = anime?.tmdb?.id
            // Improved media type detection for anime
            let mediaType = 'movie' // default
            if (anime?.type === 'series' || anime?.type === 'hoathinh' || anime?.episode_total > 1) {
              mediaType = 'tv'
            }
            
            try {
              if (tmdbId) {
                const tmdb = await fetchTmdbById(tmdbId, mediaType)
                
                return {
                  ...anime,
                  _tmdb: tmdb,
                  _poster: getBestAnimeImage(anime, tmdb, 'poster'),
                  _backdrop: getBestAnimeImage(anime, tmdb, 'backdrop'),
                }
              } else {
                // No TMDB, use original data
                return {
                  ...anime,
                  _tmdb: null,
                  _poster: getBestAnimeImage(anime, null, 'poster'),
                  _backdrop: getBestAnimeImage(anime, null, 'backdrop'),
                }
              }
            } catch (e) {
              return {
                ...anime,
                _tmdb: null,
                _poster: getBestAnimeImage(anime, null, 'poster'),
                _backdrop: getBestAnimeImage(anime, null, 'backdrop'),
              }
            }
          }))
          
          setMovies(enrichedAnime)
          return // Exit early after successful enrichment
          
        } catch (apiError) {
          // Comprehensive Fallback: Fetch from multiple sources
          const allAnimeMovies = []
          
          // Source 1: Try different API endpoints
          try {
            // Try basic hoat-hinh without country filter
            const basicResponse = await fetch(`https://phimapi.com/v1/api/danh-sach/hoat-hinh?page=1&limit=64`)
            if (basicResponse.ok) {
              const basicData = await basicResponse.json()
              const basicItems = Array.isArray(basicData?.items || basicData?.data) ? (basicData.items || basicData.data) : []
              allAnimeMovies.push(...basicItems)
            }
            
            // Try fetchAnimeMovies from service
            const animeData = await fetchAnimeMovies(1, 64)
            const animeItems = Array.isArray(animeData?.items || animeData?.data) ? (animeData.items || animeData.data) : []
            allAnimeMovies.push(...animeItems)
            
            // Try fetchMoviesByCategory
            const categoryData = await fetchMoviesByCategory('hoat-hinh', 1, 64)
            const categoryItems = Array.isArray(categoryData?.items || categoryData?.data) ? (categoryData.items || categoryData.data) : []
            allAnimeMovies.push(...categoryItems)
            
          } catch (e) {
            // Silent fail for alternative APIs
          }
          
          // Source 2: Latest movies filtered for anime (last resort)
          const maxPagesToFetch = 10 // Reduce để tránh quá chậm
          
          for (let p = 1; p <= maxPagesToFetch; p++) {
            try {
              const data = await fetchLatestMoviesV3(p)
              const pageMovies = Array.isArray(data?.items || data?.data) ? (data.items || data.data) : []
              const pageAnime = pageMovies.filter(isAnime)
              
              if (pageAnime.length > 0) {
                allAnimeMovies.push(...pageAnime)
              }
              
              // Stop early if we have enough
              if (allAnimeMovies.length >= pageNum * itemsPerPage) {
                break
              }
            } catch (e) {
              break
            }
          }
          
          // Remove duplicates based on slug
          const uniqueAnime = allAnimeMovies.filter((movie, index, self) => 
            index === self.findIndex(m => m.slug === movie.slug)
          )
          
          // Calculate pagination
          const totalAnime = uniqueAnime.length
          const animeTotalPages = Math.ceil(totalAnime / itemsPerPage)
          setTotalPages(Math.max(1, animeTotalPages))
          setTotalItems(totalAnime)
          
          // Get anime for current page
          const startIndex = (pageNum - 1) * itemsPerPage
          const endIndex = startIndex + itemsPerPage
          movieList = uniqueAnime.slice(startIndex, endIndex)
        }
      }
      
      // Enrich with TMDB data (fallback mode)
      const enrichedMovies = await Promise.all(movieList.map(async (movie) => {
        const tmdbId = movie?.tmdb?.id
        // Improved media type detection for anime
        let mediaType = 'movie' // default
        if (movie?.type === 'series' || movie?.type === 'hoathinh' || movie?.episode_total > 1) {
          mediaType = 'tv'
        }
        
        try {
          if (tmdbId) {
            const tmdb = await fetchTmdbById(tmdbId, mediaType)
            
            return {
              ...movie,
              _tmdb: tmdb,
              _poster: getBestAnimeImage(movie, tmdb, 'poster'),
              _backdrop: getBestAnimeImage(movie, tmdb, 'backdrop'),
            }
          } else {
            // No TMDB, use original data
            return {
              ...movie,
              _tmdb: null,
              _poster: getBestAnimeImage(movie, null, 'poster'),
              _backdrop: getBestAnimeImage(movie, null, 'backdrop'),
            }
          }
        } catch (e) {
          return {
            ...movie,
            _tmdb: null,
            _poster: getBestAnimeImage(movie, null, 'poster'),
            _backdrop: getBestAnimeImage(movie, null, 'backdrop'),
          }
        }
      }))
      
      setMovies(enrichedMovies)
      
    } catch (e) {
      setError(e?.message || 'Không thể tải danh sách anime')
    } finally {
      setLoading(false)
    }
  }

  // Load movies when page or keyword changes
  useEffect(() => {
    loadMovies(page, keyword)
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

  // Handle page change - chỉ cho phép nhảy tối đa 2 trang
  const handlePageChange = (newPage) => {
    if (newPage < 1) return
    
    // Giới hạn: chỉ cho phép nhảy tối đa 2 trang từ trang hiện tại
    const maxJump = 2
    if (Math.abs(newPage - page) > maxJump) {
      return
    }
    
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
    <div className='anime-list-page'>
      <Navbar />
      
      <div className='anime-list-container'>
        {/* Header */}
        <div className='movies-header'>
          <button onClick={() => navigate('/')} className='back-btn'>
            ← Trang chủ
          </button>
          <h1>{pageTitle}</h1>
          <p>Trang {page} / {totalPages} • {totalItems.toLocaleString()} anime</p>
        </div>

        {/* Search Bar */}
        <div className='search-bar-container'>
          <div className='search-bar'>
            <input 
              type='text'
              placeholder='Tìm kiếm anime theo tên, thể loại...' 
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
              <span>Kết quả tìm kiếm anime cho: "<strong>{keyword}</strong>"</span>
              <button className='clear-search-link' onClick={clearSearch}>
                Xem tất cả anime
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
                <p>Đang tìm kiếm anime "{keyword}" toàn bộ...</p>
                <p className='loading-subtitle'>Đang tìm kiếm trong kho anime...</p>
                <div className='search-strategies'>
                  <div>✓ Tìm kiếm trực tiếp anime</div>
                  <div>✓ Tìm từng từ riêng lẻ</div>
                  <div>✓ Tìm từ đồng nghĩa anime</div>
                  <div>✓ Lọc từ anime mới nhất</div>
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
                  key={movie.slug || index} 
                  className='movie-card'
                  onClick={() => handleMovieClick(movie)}
                >
                  <div className='movie-poster'>
                    <img 
                      src={movie?._poster || movie?._backdrop || ''} 
                      alt={movie?.name || movie?.origin_name || 'anime'} 
                      loading='lazy'
                    />
                    <div className='movie-overlay'>
                      <div className='movie-info'>
                        <h3>{movie?.name || movie?.origin_name}</h3>
                        <p>{movie?.year || movie?._tmdb?.release_date?.split('-')[0]}</p>
                        {movie?.quality && <span className='quality'>{movie.quality}</span>}
                        <span className='anime-tag'>🎌 Anime</span>
                        {movie?._tmdb && (
                          <span className='tmdb-indicator' title='Có dữ liệu TMDB chất lượng cao'>
                            ✨ HD
                          </span>
                        )}
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
                <h3>🔍 Không tìm thấy anime nào</h3>
                <p><strong>Trang hiện tại:</strong> {page}</p>
                <p><strong>Tổng số trang:</strong> {totalPages}</p>
                <p><strong>Tổng số anime:</strong> {totalItems}</p>
                
                <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button onClick={() => loadMovies(page, keyword)}>🔄 Thử lại</button>
                  {page > 1 && (
                    <button onClick={() => handlePageChange(1)}>📄 Về trang 1</button>
                  )}
                  <button onClick={() => navigate('/')}>🏠 Về trang chủ</button>
                </div>
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
                      <span key={index} className='dots'>...</span>
                    ) : (
                      <button
                        key={pageNum}
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

export default AnimeList
