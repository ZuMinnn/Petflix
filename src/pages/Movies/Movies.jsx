import React, { useEffect, useMemo, useState } from 'react'
import './Movies.css'
import Navbar from '../../components/Navbar/Navbar'
import Footer from '../../components/Footer/Footer'
import { fetchLatestMoviesV3, fetchMovieDetailBySlug } from '../../services/phimapi'
import { fetchTmdbById, buildTmdbImagePath } from '../../services/tmdb'
import MovieDetailsPanel from '../../components/MovieDetailsPanel/MovieDetailsPanel'

const Movies = () => {
  const [page, setPage] = useState(1)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        setError('')
        const data = await fetchLatestMoviesV3(page)
        const list = Array.isArray(data?.items || data?.data) ? (data.items || data.data) : []

        // Enrich with TMDB images when available
        const enriched = await Promise.all(list.map(async (it) => {
          const tmdbId = it?.tmdb?.id
          const mediaType = it?.type === 'series' ? 'tv' : 'movie'
          if (tmdbId) {
            const tmdb = await fetchTmdbById(tmdbId, mediaType)
            return {
              ...it,
              _tmdb: tmdb,
              _poster: buildTmdbImagePath(tmdb?.poster_path, 'w342') || it?.poster_url || '',
              _backdrop: buildTmdbImagePath(tmdb?.backdrop_path, 'w780') || it?.thumb_url || '',
            }
          }
          return {
            ...it,
            _tmdb: null,
            _poster: it?.poster_url || '',
            _backdrop: it?.thumb_url || '',
          }
        }))

        if (!cancelled) setItems(enriched)
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [page])

  const title = useMemo(() => 'Phim mới cập nhật', [])

  const handleOpenDetail = async (movie) => {
    setSelected(movie)
    setDetail(null)
    setOpen(true)
    if (!movie?.slug) return
    try {
      setDetailLoading(true)
      const d = await fetchMovieDetailBySlug(movie.slug)
      setDetail(d)
    } catch (e) {
      console.error(e)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleCloseDetail = () => {
    setOpen(false)
    setSelected(null)
    setDetail(null)
  }

  return (
    <div className='movies-page'>
      <Navbar />
      <div className='movies-container'>
        <h2>{title}</h2>
        {error && <div className='movies-error'>{error}</div>}
        {loading ? (
          <div className='movies-loading'>Loading...</div>
        ) : (
          <div className='movies-grid'>
            {items.map((m, idx) => (
              <div className='movie-card' key={m?.slug || idx}>
                <div className='movie-thumb'>
                  {/* poster/backdrop */}
                  <img src={m?._poster || m?._backdrop || ''} alt={m?.name || m?.origin_name || 'movie'} loading='lazy' />
                  <button className='expand-btn' title='Chi tiết' onClick={() => handleOpenDetail(m)}>
                    <span>↓</span>
                  </button>
                </div>
                <div className='movie-meta'>
                  <p className='movie-title'>{m?.name || m?.origin_name || m?.title}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className='movies-pagination'>
          <button disabled={page<=1} onClick={() => setPage(p => Math.max(1, p-1))}>Trang trước</button>
          <span>Trang {page}</span>
          <button onClick={() => setPage(p => p+1)}>Trang sau</button>
        </div>
      </div>
      <Footer />
      <MovieDetailsPanel open={open} onClose={handleCloseDetail} movie={selected} detail={detail} />
    </div>
  )
}

export default Movies


