import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import './Player.css'
import back_arrow from '../../assets/back_arrow_icon.png'
import { buildEmbedUrl } from '../../utils/embed'
import MovieDetailsPanel from '../../components/MovieDetailsPanel/MovieDetailsPanel'
import SafeIframe from '../../components/SafeIframe/SafeIframe'
import { fetchMovieDetailBySlug } from '../../services/phimapi'
import { auth, saveWatchProgress } from '../../firebase'
import { useAuthState } from 'react-firebase-hooks/auth'

const Player = () => {
  const { id, type } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [user] = useAuthState(auth);
  const [movieData, setMovieData] = useState(null);
  const [loading, setLoading] = useState(true);
  const videoRef = useRef(null);
  const [title, setTitle] = useState('');
  const lastSavedRef = useRef(0);
  const [useHLS, setUseHLS] = useState(false);
  const [forceHLS, setForceHLS] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [episodes, setEpisodes] = useState([]);
  const [currentEpisode, setCurrentEpisode] = useState(null);
  const [showMovieDetails, setShowMovieDetails] = useState(false);
  const [movieDetail, setMovieDetail] = useState(null);

  const progressKey = useMemo(() => {
    const movieSlug = location.state?.movieSlug;
    const episodeSlug = location.state?.episodeSlug || location.state?.title || location.state?.link_m3u8 || location.state?.link_embed;
    
    if (!movieSlug || !episodeSlug) {
      return null;
    }
    
    const key = `watchProgress:${movieSlug}:${episodeSlug}`;
    return key;
  }, [location.state?.movieSlug, location.state?.episodeSlug, location.state?.title, location.state?.link_m3u8, location.state?.link_embed]);
  

  // TMDB API options
  const options = {
    method: 'GET',
    headers: {
      accept: 'application/json',
      Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI0NGZjMzdlMTdkMTc3NmRkZGZmNjYyMDgyNTlmNzA3ZSIsIm5iZiI6MTc1NjMwMjg2Ny4xNjksInN1YiI6IjY4YWYwZTEzZjE4MWIwOGZlNjRlYmU0ZCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.adMYFbirP6rCF0jtSRvDdpiSC0PLaVEFuQyS0i0od4Q'
    }
  };

  // Lấy thông tin phim từ TMDB
  useEffect(() => {
    const fetchMovieData = async () => {
      try {
        if (!id) { setLoading(false); return; }
        const response = await fetch(`https://api.themoviedb.org/3/movie/${id}?language=en-US`, options);
        const data = await response.json();
        setMovieData(data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching movie data:', error);
        setLoading(false);
      }
    };

      fetchMovieData();
  }, [id]);

  // Derive title from route state or TMDB
  useEffect(() => {
    if (location.state?.title) {
      setTitle(location.state.title);
    } else if (movieData?.title) {
      setTitle(movieData.title);
    }
  }, [location.state?.title, movieData?.title]);

  // Lấy danh sách tập từ location.state
  useEffect(() => {
    if (location.state?.episodes) {
      // Flatten episodes từ cấu trúc server_data
      const flattenedEpisodes = [];
      location.state.episodes.forEach(server => {
        if (server.server_data && Array.isArray(server.server_data)) {
          server.server_data.forEach(ep => {
            flattenedEpisodes.push({
              ...ep,
              server_name: server.server_name
            });
          });
        }
      });
      
      setEpisodes(flattenedEpisodes);
      
      // Tìm tập hiện tại dựa trên episodeSlug
      const current = flattenedEpisodes.find(ep => 
        ep.slug === location.state?.episodeSlug ||
        ep.title === location.state?.episodeSlug ||
        ep.name === location.state?.episodeSlug
      );
      setCurrentEpisode(current);
    }
  }, [location.state?.episodes, location.state?.episodeSlug]);

  // Initialize Embed first, HLS as fallback
  useEffect(() => {
    const m3u8 = location.state?.link_m3u8;
    const embed = location.state?.link_embed;
    const videoEl = videoRef.current;
    if (!videoEl) return;
    
    // Prioritize embed first
    if (!embed) {
      if (m3u8) setUseHLS(true);
      return;
    }

    let hlsInstance = null;
    const setupNative = () => {
      videoEl.src = m3u8;
    };

    const setupHls = () => {
      // eslint-disable-next-line no-undef
      const HlsCtor = window.Hls;
      if (HlsCtor && HlsCtor.isSupported()) {
        hlsInstance = new HlsCtor();
        hlsInstance.loadSource(m3u8);
        hlsInstance.attachMedia(videoEl);
        try {
          hlsInstance.on(HlsCtor.Events.ERROR, (event, data) => {
            if (data?.fatal) {
              console.log('HLS fatal error, staying with embed');
            }
          });
        } catch (_) {}
        const onVideoError = () => { 
          console.log('HLS video error, staying with embed');
        };
        videoEl.addEventListener('error', onVideoError);
        // cleanup video error listener
        const cleanupVideo = () => videoEl.removeEventListener('error', onVideoError);
        // attach to cleanup below via return function
        // eslint-disable-next-line consistent-return
        return cleanupVideo;
      } else if (videoEl.canPlayType('application/vnd.apple.mpegURL')) {
        setupNative();
      } else {
        setupNative();
      }
    };

    if (window.Hls) {
      setupHls();
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
      script.async = true;
      script.onload = setupHls;
      document.body.appendChild(script);
      return () => {
        document.body.removeChild(script);
        if (hlsInstance) {
          hlsInstance.destroy();
        }
      };
    }

    return () => {
      if (hlsInstance) {
        hlsInstance.destroy();
      }
    };
  }, [location.state?.link_m3u8, location.state?.link_embed, forceHLS]);

  // Restore saved progress when metadata is ready (m3u8 only)
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !location.state?.link_m3u8 || !progressKey) return;

    const onLoadedMetadata = () => {
      try {
        const raw = localStorage.getItem(progressKey);
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (typeof saved?.currentTime === 'number' && saved.currentTime > 0 && saved.currentTime < videoEl.duration) {
          videoEl.currentTime = saved.currentTime;
        }
      } catch (_) {}
    };

    videoEl.addEventListener('loadedmetadata', onLoadedMetadata);
    return () => {
      videoEl.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }, [progressKey, location.state?.link_m3u8]);

  // Persist progress periodically and on unload
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!progressKey) return;
    
    // For embed videos, we can't track time, so save basic info
    if (!videoEl && location.state?.link_embed && user) {
      const movieSlug = location.state?.movieSlug;
      const episodeSlug = location.state?.episodeSlug;
      
      if (movieSlug && episodeSlug) {
        const payload = {
          currentTime: 0,
          duration: 0,
          title: title || 'Unknown Movie',
          hasEmbed: true
        };
        
        saveWatchProgress(user.uid, movieSlug, episodeSlug, payload);
      }
      return;
    }
    
    // For HLS videos with video element
    if (!videoEl || !location.state?.link_m3u8) return;

    const saveNow = () => {
      if (!user) return;
      
      const movieSlug = location.state?.movieSlug;
      const episodeSlug = location.state?.episodeSlug;
      
      if (!movieSlug || !episodeSlug) return;
      
      try {
        const payload = {
          currentTime: Math.floor(videoEl.currentTime || 0),
          duration: Math.floor(videoEl.duration || 0),
          title: title || 'Unknown Movie',
        };
        
        // Save to Firebase instead of localStorage
        saveWatchProgress(user.uid, movieSlug, episodeSlug, payload);
      } catch (e) {
        console.error('❌ Error saving progress:', e);
      }
    };

    const onTimeUpdate = () => {
      const now = Date.now();
      if (now - lastSavedRef.current > 5000) {
        lastSavedRef.current = now;
        saveNow();
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') saveNow();
    };

    window.addEventListener('beforeunload', saveNow);
    document.addEventListener('visibilitychange', onVisibility);
    videoEl.addEventListener('timeupdate', onTimeUpdate);

    return () => {
      window.removeEventListener('beforeunload', saveNow);
      document.removeEventListener('visibilitychange', onVisibility);
      videoEl.removeEventListener('timeupdate', onTimeUpdate);
      saveNow();
    };
  }, [progressKey, location.state?.link_m3u8, title, user]);

  // Tạo URL embed từ template cấu hình
  const getEmbedUrl = () => buildEmbedUrl(id);

  const handleBack = () => {
    // Quay về trang trước đó (nơi hiển thị MovieDetailsPanel)
    navigate(-1);
  };

  const openMovieDetails = async () => {
    // Mở MovieDetailsPanel ngay trong Player
    if (location.state?.movieSlug) {
      try {
        setLoading(true);
        const detail = await fetchMovieDetailBySlug(location.state.movieSlug);
        setMovieDetail(detail);
        setShowMovieDetails(true);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching movie details:', error);
        setLoading(false);
        // Fallback: quay về trang trước
        navigate(-1);
      }
    } else {
      // Fallback: quay về trang chủ
      navigate('/');
    }
  };

  const closeMovieDetails = () => {
    setShowMovieDetails(false);
  };

  const handleEpisodeChange = (episode) => {
    if (episode && (episode.link_m3u8 || episode.link_embed)) {
      // Cập nhật currentEpisode ngay lập tức trước khi navigate
      setCurrentEpisode(episode);
      
      // Cập nhật state với tập mới
      const newState = {
        ...location.state,
        link_m3u8: episode.link_m3u8,
        link_embed: episode.link_embed,
        episodeSlug: episode.slug || episode.title || episode.name,
        title: `${location.state?.title?.split(' - ')[0] || title} - ${episode.title || episode.name || episode.slug}`,
        episodes: location.state?.episodes // Đảm bảo episodes được truyền tiếp
      };
      

      
      // Điều hướng với state mới
      navigate('/watch', { state: newState, replace: true });
    }
  };

  const openSourceInNewTab = () => {
    const url = (useHLS || forceHLS) && location.state?.link_m3u8 ? location.state.link_m3u8 : location.state?.link_embed;
    if (url) window.open(url, '_blank');
  };

  const toggleSource = () => {
    if (location.state?.link_m3u8 && location.state?.link_embed) {
      setForceHLS(!forceHLS);
    }
  };

  if (loading) {
  return (
      <div className="player-loading">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
    </div>
    );
  }

  return (
    <div className="player">
      {/* Top Bar - only Back button */}
      <div className={'player-top-bar show'}>
        <button className="back-button" onClick={handleBack}>
          <img src={back_arrow} alt="Back" />
          Back
        </button>
        {title && (
          <div className="movie-title">
            <h2>{title}</h2>
          </div>
        )}
        <div className="player-controls-right">
          {/* Episode Selector */}
          {episodes.length > 0 && (
            <div className="episode-selector">
              <select 
                value={(() => {
                  const currentIndex = episodes.findIndex(ep => 
                    ep.slug === location.state?.episodeSlug ||
                    ep.title === location.state?.episodeSlug ||
                    ep.name === location.state?.episodeSlug ||
                    ep.slug === currentEpisode?.slug ||
                    ep.title === currentEpisode?.title ||
                    ep.name === currentEpisode?.name
                  );

                  return currentIndex >= 0 ? currentIndex : 0;
                })()}
                onChange={(e) => {
                  const selectedIndex = parseInt(e.target.value);
                  const selected = episodes[selectedIndex];
                  if (selected) {
                    handleEpisodeChange(selected);
                  }
                }}
                className="episode-dropdown"
              >
                {episodes.map((ep, index) => {
                  const episodeName = ep.title || ep.name || ep.slug || `Tập ${index + 1}`;
                  return (
                    <option key={index} value={index}>
                      {episodeName}
                    </option>
                  );
                })}
              </select>
            </div>
          )}
          
          {/* Movie Details Button */}
          <button className="movie-details-btn" onClick={openMovieDetails}>
            Detail
          </button>

          {/* Home Button */}
          <button className="home-btn" onClick={() => navigate('/')}>
            Home
          </button>

          {/* Source Controls */}
          {(location.state?.link_m3u8 || location.state?.link_embed) && (
            <div className="source-controls">
              {location.state?.link_m3u8 && location.state?.link_embed && (
                <button 
                  className={`source-toggle ${forceHLS ? 'active' : ''}`} 
                  onClick={toggleSource}
                >
                  {forceHLS ? 'Embed' : 'HLS'}
                </button>
              )}
          </div>
          )}
        </div>
      </div>

      {/* Video Container */}
      <div className="video-container">
        {(useHLS || forceHLS) && location.state?.link_m3u8 ? (
          <video
            ref={videoRef}
            className="hls-video"
            controls
            autoPlay
            playsInline
          />
        ) : location.state?.link_embed ? (
          <SafeIframe
            src={location.state?.link_embed}
            title={title || 'Movie Player'}
            onError={() => {
              console.warn('Embed iframe failed, falling back to HLS if available')
              if (location.state?.link_m3u8) {
                setUseHLS(true)
              }
            }}
            fallback={
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',width:'100%',height:'100%',color:'#bbb'}}>
                Không thể tải video embed. {location.state?.link_m3u8 ? 'Đang chuyển sang HLS...' : 'Vui lòng thử lại.'}
              </div>
            }
          />
        ) : (
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',width:'100%',height:'100%',color:'#bbb'}}>Không có nguồn phát. Vui lòng quay lại và chọn tập khác.</div>
        )}
          </div>

      {/* Movie Details Panel */}
      {showMovieDetails && movieDetail && (
        <MovieDetailsPanel
          open={showMovieDetails}
          onClose={closeMovieDetails}
          movie={{
            slug: location.state?.movieSlug,
            name: movieDetail?.movie?.name,
            origin_name: movieDetail?.movie?.origin_name,
            poster_url: movieDetail?.movie?.poster_url,
            thumb_url: movieDetail?.movie?.thumb_url
          }}
          detail={movieDetail}
        />
      )}
    </div>
  );
};

export default Player;
