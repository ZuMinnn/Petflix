import React, { useEffect } from 'react'
import Home from './pages/Home/Home'
import { Routes, Route, useNavigate } from 'react-router-dom'
import Login from './pages/Login/Login'
import Player from './pages/Player/Player'
import Movies from './pages/Movies/Movies'
import Search from './pages/Search/Search'
import SimpleMovies from './pages/SimpleMovies/SimpleMovies'
import AnimeList from './pages/AnimeList/AnimeList'
import WatchHistory from './pages/WatchHistory/WatchHistory'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase'
import { ToastContainer, toast } from 'react-toastify';

const App = () => {

  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate('/');
      } else {
        navigate('/login');
      }
    });
    return () => unsubscribe();
  }, []);


  return (
    <div>
      <ToastContainer theme='dark'/>
      <Routes>
        <Route path='/' element={<Home/>}/> 
        <Route path='/login' element={<Login/>}/> 
        <Route path='/player/:id' element={<Player/>}/> 
        <Route path='/movies' element={<Movies/>}/>
        <Route path='/watch' element={<Player/>}/>
        <Route path='/search' element={<Search/>}/>
        <Route path='/simple-movies' element={<SimpleMovies/>}/>
        <Route path='/anime-list' element={<AnimeList/>}/>
        <Route path='/watch-history' element={<WatchHistory/>}/>
      </Routes>
      
    </div>
  )
}

export default App
