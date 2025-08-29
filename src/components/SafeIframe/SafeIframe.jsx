import React, { useState, useEffect, useRef } from 'react'
import './SafeIframe.css'

const SafeIframe = ({ src, title, onError, fallback, ...props }) => {
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const iframeRef = useRef(null)

  useEffect(() => {
    const handleLoad = () => {
      setIsLoading(false)
    }

    const handleError = () => {
      setHasError(true)
      setIsLoading(false)
      if (onError) onError()
    }

    const iframe = iframeRef.current
    if (iframe) {
      iframe.addEventListener('load', handleLoad)
      iframe.addEventListener('error', handleError)
      
      // Timeout để phát hiện lỗi
      const timeout = setTimeout(() => {
        if (isLoading) {
          handleError()
        }
      }, 10000) // 10 giây timeout

      return () => {
        iframe.removeEventListener('load', handleLoad)
        iframe.removeEventListener('error', handleError)
        clearTimeout(timeout)
      }
    }
  }, [src, onError, isLoading])

  if (hasError) {
    return fallback || (
      <div className="iframe-error">
        <div className="error-icon">⚠️</div>
        <h3>Không thể tải video</h3>
        <p>Video player gặp sự cố. Vui lòng thử lại hoặc chọn nguồn khác.</p>
        <button onClick={() => window.location.reload()}>Tải lại trang</button>
      </div>
    )
  }

  return (
    <div className="safe-iframe-container">
      {isLoading && (
        <div className="iframe-loading">
          <div className="loading-spinner"></div>
          <p>Đang tải video...</p>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={src}
        title={title}
        frameBorder="0"
        allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"
        referrerPolicy="no-referrer"
        loading="lazy"
        {...props}
        style={{
          ...props.style,
          opacity: isLoading ? 0 : 1,
          transition: 'opacity 0.3s ease-in-out'
        }}
      />
    </div>
  )
}

export default SafeIframe
