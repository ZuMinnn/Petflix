import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import './MovieDetailsPanel.css'
import { buildTmdbImagePath } from '../../services/tmdb'
import { toast } from 'react-toastify'

const MovieDetailsPanel = ({ open, onClose, movie, detail }) => {
  if (!movie) return null
  const backdrop = movie?._backdrop || buildTmdbImagePath(movie?._tmdb?.backdrop_path, 'w780') || ''
  const title = movie?.name || movie?.origin_name || movie?.title || detail?.movie?.name || ''
  const desc = detail?.movie?.content || detail?.movie?.description || ''

  const firstPlayable = (() => {
    const eps = detail?.episodes || []
    for (const srv of eps) {
      for (const ep of srv?.server_data || []) {
        if (ep?.link_embed || ep?.link_m3u8) return ep
      }
    }
    return null
  })()

  const navigate = useNavigate()
  const handlePlayNow = () => {
    if (!firstPlayable) return
    
    const state = { 
      title, 
      link_embed: firstPlayable.link_embed, 
      link_m3u8: firstPlayable.link_m3u8, 
      movieSlug: movie?.slug, 
      episodeSlug: firstPlayable?.slug || firstPlayable?.name,
      episodes: detail?.episodes || [],
      returnPath: window.location.pathname
    }
    
    try { window.__lastEp = firstPlayable; window.__lastWatchState = state } catch (_) {}
    navigate('/watch', { state })
  }

  const handleEpisodeClick = (ep) => {
    const hasM3u8 = Boolean(ep?.link_m3u8)
    const hasEmbed = Boolean(ep?.link_embed)
    if (!hasM3u8 && !hasEmbed) {
      toast.error('Tập này chưa có nguồn phát hợp lệ. Vui lòng chọn tập khác.')
      return
    }
    const state = { 
      title: `${title} - ${ep?.name || ep?.slug}`, 
      link_embed: ep?.link_embed, 
      link_m3u8: ep?.link_m3u8, 
      movieSlug: movie?.slug, 
      episodeSlug: ep?.slug || ep?.name,
      episodes: detail?.episodes || [],
      returnPath: window.location.pathname
    }
    try { window.__lastEp = ep; window.__lastWatchState = state } catch (_) {}
    navigate('/watch', { state })
  }

  const readProgress = (ep) => {
    try {
      const key = `watchProgress:${movie?.slug}:${ep?.slug || ep?.name}`
      const raw = localStorage.getItem(key)
      if (!raw) return null
      const obj = JSON.parse(raw)
      if (!obj || typeof obj.currentTime !== 'number' || typeof obj.duration !== 'number') return null
      return obj
    } catch (_) { return null }
  }

  const hasAnyProgress = useMemo(() => {
    const eps = detail?.episodes || []
    for (const srv of eps) {
      for (const ep of srv?.server_data || []) {
        const pr = readProgress(ep)
        if (pr && pr.currentTime > 0) return true
      }
    }
    return false
  }, [detail, movie?.slug])

  return (
    <div className={`mdp ${open ? 'mdp-open' : 'mdp-close'}`}>
      <div className='mdp-scrim' onClick={onClose} />
      <div className='mdp-shell'>
        <div className='mdp-banner' style={{ backgroundImage: backdrop ? `url(${backdrop})` : 'none' }}>
          <div className='mdp-gradient' />
          <button className='mdp-close' onClick={onClose}>✕</button>
          <div className='mdp-banner-content'>
            <h3 className='mdp-title'>{title}</h3>
            {desc && <p className='mdp-desc'>{desc}</p>}
            <div className='mdp-actions'>
              <button className='mdp-play' onClick={handlePlayNow} disabled={!firstPlayable}>{hasAnyProgress ? 'Tiếp tục xem' : 'Phát'}</button>
            </div>
          </div>
        </div>

        <div className='mdp-body'>
          {(detail?.episodes || []).map((server, sIdx) => (
            <div className='mdp-server' key={sIdx}>
              <h4 className='mdp-server-name'>{server?.server_name}</h4>
              <div className='mdp-episode-list'>
                {(server?.server_data || []).map((ep, eIdx) => (
                  <div className='mdp-episode' key={eIdx} onClick={() => handleEpisodeClick(ep)}>
                    <div className='mdp-episode-thumb'>
                      {(() => {
                        const prog = readProgress(ep)
                        if (!prog || !prog.duration) return null
                        const percent = Math.min(100, Math.round((prog.currentTime / Math.max(prog.duration, 1)) * 100))
                        if (percent <= 0) return null
                        return <div className='mdp-progress' style={{ width: `${percent}%` }} />
                      })()}
                    </div>
                    <div className='mdp-episode-meta'>
                      <div className='mdp-episode-title'>{ep?.name || ep?.slug}</div>
                      {ep?.filename && <div className='mdp-episode-desc'>{ep.filename}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default MovieDetailsPanel


