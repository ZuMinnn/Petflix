import React, { useState, useRef, useEffect } from 'react'
import './HeroBanner.css'
import kms_title from '../../assets/AcocBanner.png'
import play_icon from '../../assets/play_icon.png'
import play_info from '../../assets/info_icon.png'
import kms from '../../assets/kms.png' // Fallback image
import TitleCards from '../TitleCards/TitleCards'
import trailerVideo from '../../assets/4ktrailer.mp4'


const HeroBanner = ({ 
  trailerUrl = null // Có thể truyền URL trailer từ bên ngoài
}) => {
  const [videoError, setVideoError] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const videoRef = useRef(null)
  const titleCardsRef = useRef(null)

  // Sử dụng trailer.mp4 từ assets folder
  const finalTrailerUrl = trailerUrl || trailerVideo

  const handleVideoError = () => {
    setVideoError(true)
  }

  const handleVideoLoad = () => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted
      
      // Thử phát video với âm thanh, nếu fail thì fallback về muted
      if (!isMuted) {
        videoRef.current.play().catch(() => {
          console.log('Autoplay with sound blocked, falling back to muted')
          setIsMuted(true)
          videoRef.current.muted = true
          videoRef.current.play()
        })
      }
    }
  }

  const toggleMute = () => {
    if (videoRef.current) {
      const newMutedState = !isMuted
      setIsMuted(newMutedState)
      videoRef.current.muted = newMutedState
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

  // Auto play video khi component mount
  useEffect(() => {
    const playVideo = async () => {
      if (videoRef.current && finalTrailerUrl) {
        try {
          // Thử phát với âm thanh trước
          videoRef.current.muted = false
          await videoRef.current.play()
          setIsMuted(false)
        } catch (error) {
          // Nếu không được, phát muted
          console.log('Autoplay with sound blocked, playing muted')
          videoRef.current.muted = true
          setIsMuted(true)
          try {
            await videoRef.current.play()
          } catch (mutedError) {
            console.log('Autoplay completely blocked')
          }
        }
      }
    }

    // Delay một chút để video load xong
    const timer = setTimeout(playVideo, 1000)
    return () => clearTimeout(timer)
  }, [finalTrailerUrl])

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
          <button className="volume-control" onClick={toggleMute}>
            {isMuted ? '🔇' : '🔊'}
          </button>
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
