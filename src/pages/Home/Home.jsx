import React from 'react'
import './Home.css' 
import Navbar from '../../components/Navbar/Navbar'
import HeroBanner from '../../components/HeroBanner/HeroBanner'
import TitleCards from '../../components/TitleCards/TitleCards'
import Footer from '../../components/Footer/Footer'
// import Flag from '../../assets/VNFLAG.jpg'

const Home = () => {
  return (
    <div className='home'>  
      <Navbar/>
      <HeroBanner/>
      
      {/* Vietnam Pride Section
              <div className="vietnam-pride-section">
          <div className="pride-content">
            <h2> Mừng Đại Lễ - Tự Hào Việt Nam <img src={Flag} alt="Cờ Việt Nam" className="vn-flag" /></h2>
          </div>
        </div> */}

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
