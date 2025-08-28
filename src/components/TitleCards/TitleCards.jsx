import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './TitleCards.css'
import { fetchLatestMoviesV3, fetchMovieDetailBySlug } from '../../services/phimapi'
import { fetchTmdbById, buildTmdbImagePath } from '../../services/tmdb'
import MovieDetailsPanel from '../MovieDetailsPanel/MovieDetailsPanel'

const TitleCards = ({title,category}) => {

  const [apiData, setApiData ] = useState([]);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const cardsRef = useRef();

  // Handle title click to navigate to SimpleMovies
  const handleTitleClick = () => {
    navigate(`/simple-movies?page=1`)
  }

  const options = { };

  const handleScroll = () => {
    if (cardsRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = cardsRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  }

  const scrollLeft = () => {
    if (cardsRef.current) {
      cardsRef.current.scrollBy({
        left: -240,
        behavior: 'smooth'
      });
    }
  }

  const scrollRight = () => {
    if (cardsRef.current) {
      cardsRef.current.scrollBy({
        left: 240,
        behavior: 'smooth'
      });
    }
  }

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

  useEffect(()=>{
    let cancelled = false;
    async function load(){
      try {
        let data;
        let list = [];
        
        if (category === 'anime') {
          // Lấy nhiều pages để có đủ anime
          const promises = [
            fetchLatestMoviesV3(1),
            fetchLatestMoviesV3(2),
            fetchLatestMoviesV3(3),
            fetchLatestMoviesV3(4),
            fetchLatestMoviesV3(5)
          ];
          
          const results = await Promise.all(promises);
          const allMovies = results.flatMap(result => 
            Array.isArray(result?.items || result?.data) ? (result.items || result.data) : []
          );
          
          // Lọc anime: type = "hoathinh" và country có "Nhật Bản"
          list = allMovies.filter(movie => {
            const isHoatHinh = movie?.type === 'hoathinh';
            const isJapanese = movie?.country?.some(c => 
              c?.name === 'Nhật Bản' || c?.slug === 'nhat-ban'
            );
            return isHoatHinh && isJapanese && movie?.tmdb?.id;
          }).slice(0, 24); // Giới hạn 24 phim
          
        } else {
          // Logic cũ cho các section khác
          const pageMap = {
            'phim-le': 1,
            'phim-bo': 2, 
            'tv-shows': 4,
            'hoat-hinh': 5,
            'top_rated': 6
          };
          const page = pageMap[category] || 1;
          
          data = await fetchLatestMoviesV3(page);
          list = Array.isArray(data?.items || data?.data) ? (data.items || data.data) : [];
          
          // Lọc phim có TMDB ID
          list = list.filter(it => it?.tmdb?.id);
        }
        
        const enriched = await Promise.all(list.map(async (it) => {
          const tmdbId = it?.tmdb?.id
          const mediaType = it?.type === 'series' ? 'tv' : 'movie'
          try {
            const tmdb = await fetchTmdbById(tmdbId, mediaType)
            return {
              ...it,
              _tmdb: tmdb,
              _poster: buildTmdbImagePath(tmdb?.poster_path, 'w342') || it?.poster_url || '',
              _backdrop: buildTmdbImagePath(tmdb?.backdrop_path, 'w780') || it?.thumb_url || '',
            }
          } catch (e) {
            console.error('TMDB fetch error for', tmdbId, e);
            return {
              ...it,
              _tmdb: null,
              _poster: it?.poster_url || '',
              _backdrop: it?.thumb_url || '',
            }
          }
        }))
        
        if (!cancelled) setApiData(enriched)
      } catch (e) {
        console.error('TitleCards load error:', e)
      }
    }
    load();

    if (cardsRef.current) {
      cardsRef.current.addEventListener('scroll', handleScroll);
    }

    return () => {
      cancelled = true;
      if (cardsRef.current) {
        cardsRef.current.removeEventListener('scroll', handleScroll);
      }
    }
  },[category])

  // Force initial check for arrow visibility
  useEffect(() => {
    if (cardsRef.current && apiData.length > 0) {
      setTimeout(() => {
        handleScroll();
      }, 100);
    }
  }, [apiData]);

  // Inline styles để đảm bảo ẩn scrollbar
  const cardListStyle = {
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    WebkitScrollbar: {
      display: 'none',
      width: '0',
      height: '0'
    }
  };

  return (
    <div className='title-cards'>
      <h2 onClick={handleTitleClick} style={{cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'}}>
        {title?title:"Popular on Petflix"} 
        <span style={{fontSize: '0.8em', opacity: 0.7}}>→</span>
      </h2>
      <div className="cards-container">
        {showLeftArrow && (
          <button className="scroll-button left-button" onClick={scrollLeft}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15.41 7.41L14 6L8 12L14 18L15.41 16.59L10.83 12L15.41 7.41Z" fill="white"/>
            </svg>
          </button>
        )}
        
        <div 
          className="card-list" 
          ref={cardsRef}
          style={cardListStyle}
        >
          {apiData.map((card, index)=>{
            return (
              <div 
                className="card" 
                key={index}
              >
                <img src={card?._backdrop || card?._poster || ''} alt={card?.name || card?.origin_name || 'movie'} />
                <div className="card-overlay">
                  <div className="card-title">
                    {card?.name || card?.origin_name || card?._tmdb?.title || card?._tmdb?.name || 'Phim'}
                  </div>
                </div>
                <button className='card-expand-btn' title='Chi tiết' onClick={() => handleOpenDetail(card)}>
                  <span>↓</span>
                </button>
              </div>
            )
          })}
        </div>

        {showRightArrow && (
          <button className="scroll-button right-button" onClick={scrollRight}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8.59 16.59L10 18L16 12L10 6L8.59 7.41L13.17 12L8.59 16.59Z" fill="white"/>
            </svg>
          </button>
        )}
      </div>
      <MovieDetailsPanel open={open} onClose={() => setOpen(false)} movie={selected} detail={detail} />
    </div>
  )
}

export default TitleCards 
