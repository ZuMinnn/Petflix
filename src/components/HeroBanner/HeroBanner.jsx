import React, { useState, useRef, useEffect } from 'react'
import './HeroBanner.css'
import kms_title from '../../assets/AcocBanner.png'
import play_icon from '../../assets/play_icon.png'
import play_info from '../../assets/info_icon.png'
import kms from '../../assets/kms.png' // Fallback image
import TitleCards from '../TitleCards/TitleCards'
import trailerVideo from '../../assets/trailer2.mp4'


const HeroBanner = ({ 
  trailerUrl = null // Có thể truyền URL trailer từ bên ngoài
}) => {
  const [videoError, setVideoError] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isMuted, setIsMuted] = useState(true) // Mặc định bị mute
  const [hasUserInteracted, setHasUserInteracted] = useState(false) // Track user interaction
  const [showMuteHint, setShowMuteHint] = useState(true) // Hiển thị gợi ý mute
  const videoRef = useRef(null)
  const titleCardsRef = useRef(null)

  // Sử dụng trailer.mp4 từ assets folder
  const finalTrailerUrl = trailerUrl || trailerVideo

  const handleVideoError = () => {
    setVideoError(true)
  }

  const handleVideoLoad = () => {
    if (videoRef.current) {
      // Luôn bắt đầu với video bị mute
      videoRef.current.muted = true
      setIsMuted(true)
    }
  }

  const toggleMute = async () => {
    if (videoRef.current) {
      const newMutedState = !isMuted
      setIsMuted(newMutedState)
      videoRef.current.muted = newMutedState
      
      // Đánh dấu user đã tương tác
      setHasUserInteracted(true)
      setShowMuteHint(false) // Ẩn gợi ý sau khi user tương tác
      
      // Nếu đang unmute và video đang pause, thử play
      if (!newMutedState && videoRef.current.paused) {
        try {
          await videoRef.current.play()
        } catch {
          // Nếu không thể play với sound, giữ nguyên muted
          setIsMuted(true)
          videoRef.current.muted = true
        }
      }
    }
  }

  // Auto scroll cho TitleCards
  useEffect(() => {
    let animationId
    let lastTime = 0
    const scrollSpeed = 0.5 // pixels per frame
    
    const autoScroll = (currentTime) => {
      if (currentTime - lastTime >= 16) { // ~60fps
        if (!isPaused) {
          const container = document.querySelector('.hero-title-cards .card-list')
          if (container) {
            const { scrollLeft, scrollWidth, clientWidth } = container
            
            // Nếu đã scroll đến cuối, quay về đầu với delay
            if (scrollLeft >= scrollWidth - clientWidth - 10) {
              setTimeout(() => {
                if (container) {
                  container.scrollTo({
                    left: 0,
                    behavior: 'smooth'
                  })
                }
              }, 2000) // Dừng 2 giây trước khi quay về đầu
            } else {
              // Scroll chậm và mượt
              container.scrollLeft += scrollSpeed
            }
          }
        }
        lastTime = currentTime
      }
      
      if (!isPaused) {
        animationId = requestAnimationFrame(autoScroll)
      }
    }

    if (!isPaused) {
      animationId = requestAnimationFrame(autoScroll)
    }
    
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId)
      }
    }
  }, [isPaused])

  // Auto play video khi component mount (luôn muted)
  useEffect(() => {
    const playVideo = async () => {
      if (videoRef.current && finalTrailerUrl) {
        try {
          // Luôn phát video với muted để tránh autoplay policy
          videoRef.current.muted = true
          setIsMuted(true)
          await videoRef.current.play()
        } catch {
          // Autoplay failed, but video can still be played manually
        }
      }
    }

    // Delay một chút để video load xong
    const timer = setTimeout(playVideo, 1000)
    return () => clearTimeout(timer)
  }, [finalTrailerUrl])

  // Ẩn gợi ý mute sau 5 giây
  useEffect(() => {
    const hintTimer = setTimeout(() => {
      setShowMuteHint(false)
    }, 5000)

    return () => clearTimeout(hintTimer)
  }, [])

  // Pause khi hover vào section
  const handleMouseEnter = () => {
    setIsPaused(true)
  }

  const handleMouseLeave = () => {
    setIsPaused(false)
  }

  return (
    <div className="hero-banner">
      {!videoError && finalTrailerUrl ? (
        <video
          ref={videoRef}
          className="hero-video"
          loop
          playsInline
          onError={handleVideoError}
          onLoadedData={handleVideoLoad}
        >
          <source src={finalTrailerUrl} type="video/mp4" />
          Trình duyệt của bạn không hỗ trợ video.
        </video>
      ) : (
        <img src={kms} alt="Hero Banner" className="hero-image" />
      )}
      
      {/* Gradient overlay để text rõ hơn */}
      <div className="hero-gradient"></div>
      
      {/* Volume control button */}
      {!videoError && finalTrailerUrl && (
        <div className="video-controls">
          <div className="age-rating">13+</div>
          <div className="volume-control-wrapper">
            <button 
              className={`volume-control ${isMuted ? 'muted' : 'unmuted'}`} 
              onClick={toggleMute}
              title={isMuted ? 'Bật tiếng' : 'Tắt tiếng'}
              aria-label={isMuted ? 'Bật tiếng video' : 'Tắt tiếng video'}
            >
              {isMuted ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                </svg>
              )}
            </button>
            {/* Mute hint tooltip */}
            {showMuteHint && !hasUserInteracted && (
              <div className="mute-hint">
                <div className="hint-arrow"></div>
                <span>Nhấn để bật tiếng</span>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Caption content */}
      <div className="hero-caption">
        <img src={kms_title} alt="Movie Title" className="caption-img" />
        <p>Two children who got swapped at birth grow up to become engaged to each other. 
          It's an arrangement neither of them like, at first.</p>
        <div className="hero-btns">
          <button className='btn'>
            <img src={play_icon} alt="" />
            Play
          </button>
          <button className='btn dark-btn'>
            <img src={play_info} alt="" />
            More Info
          </button>
        </div>
        
        {/* TitleCards nằm trong banner như P-Series */}
        <div 
          className="hero-title-cards"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          ref={titleCardsRef}
        >
          <TitleCards />
        </div>
      </div>
    </div>
  )
}

export default HeroBanner
