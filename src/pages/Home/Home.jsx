import React from 'react'
import './Home.css' 
import Navbar from '../../components/Navbar/Navbar'
import HeroBanner from '../../components/HeroBanner/HeroBanner'
import TitleCards from '../../components/TitleCards/TitleCards'
import Footer from '../../components/Footer/Footer'

const Home = () => {
  return (
    <div className='home'>  
      <Navbar/>
      <HeroBanner/>
      <div className="more-cards">
        <TitleCards title={"Phim Lẻ "} category={"phim-le"}/>
        <TitleCards title={"Phim Bộ "} category={"phim-bo"}/>
        <TitleCards title={"Anime "} category={"anime"}/>
        <TitleCards title={"TV Shows"} category={"tv-shows"}/>
        <TitleCards title={"Phim Thập cẩm"} category={"hoat-hinh"}/>
        {/* <TitleCards title={"Phim Được Đề Xuất"} category={"top_rated"}/> */}
      </div>
      <Footer/>
    </div>
  )
}

export default Home
