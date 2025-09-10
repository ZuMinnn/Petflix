import React, { useState, useEffect } from 'react'
import './Navbar.css'
import logo from '../../assets/Plogo.png'
import search_icon from '../../assets/search_icon.svg'
import bell_icon from '../../assets/bell_icon.svg'
import profile_img from '../../assets/profile_img.png'
import caret_icon from '../../assets/caret_icon.svg'
import { logout, getUserData, auth } from '../../firebase'
import { useNavigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'


const Navbar = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');
  
  const handleHomeClick = () => {
    navigate('/');
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userData = await getUserData(user.uid);
          if (userData && userData.name) {
            setUserName(userData.name);
          } else {
            // Fallback to email if name is not available
            setUserName(user.email?.split('@')[0] || 'User');
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          setUserName(user.email?.split('@')[0] || 'User');
        }
      } else {
        setUserName('');
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className='navbar'>
      <div className="navbar-left">
        <img 
          src={logo} 
          alt="Petflix Logo" 
          onClick={handleHomeClick}
          style={{ cursor: 'pointer' }}
        />
        <ul>
            <li onClick={handleHomeClick} style={{ cursor: 'pointer' }}>Home</li>
            <li onClick={() => navigate('/simple-movies?page=1')} style={{ cursor: 'pointer' }}>TV Shows</li>
            <li onClick={() => navigate('/simple-movies?page=1')} style={{ cursor: 'pointer' }}>Movies</li>
            <li onClick={() => navigate('/movies')} style={{ cursor: 'pointer' }}>New & Popular</li>
            <li onClick={() => navigate('/anime-list?page=1')} style={{ cursor: 'pointer' }}>Anime</li>
            <li>Browser By Language</li>
        </ul>
      </div>
      <div className='navbar-right'>
        <img src={search_icon} alt=""className='icons' onClick={() => navigate('/search')} />
        <p>{userName || 'User'}</p>
        <img src={bell_icon} alt="" className='icons' />
        <div className="navbar-profile">
          <img src={profile_img} alt="" className='profile' />
          <img src={caret_icon} alt=""  />
          <div className="dropdown">
            <p onClick={() => navigate('/watch-history')}>Phim đã xem</p>
            <p onClick={() => {logout()}}>Sign Out of Petfilx</p>
          </div>
        </div>
      </div>
    </div>
  )
}
 
export default Navbar
