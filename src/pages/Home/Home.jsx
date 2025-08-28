import React from 'react'
import './Home.css' 
import Navbar from '../../components/Navbar/Navbar'
// import hero_banner from '../../assets/hero_banner.jpg'
import kms from '../../assets/kms.png'
import kms_title from '../../assets/kms_title.png'
import play_icon from '../../assets/play_icon.png'
import play_info from '../../assets/info_icon.png'
import TitleCards from '../../components/TitleCards/TitleCards'
import Footer from '../../components/Footer/Footer'

const Home = () => {
  return (
    <div className='home'>  
      <Navbar/>
      <div className="hero">
        <img src={kms} alt="" className='banner-img' />
        <div className="hero-caption">
          <img src={kms_title} alt="" className='caption-img' />
          <p>His family is massacred and his sister is cursed after a demon attack. 
            Tanjiro embarks on a dangerous journey to bring her back to human form and take revenge.</p>
            <div className="hero-btns">
              <button className='btn'><img src={play_icon} alt="" />Play</button>
              <button className='btn dark-btn'><img src={play_info} alt="" />More Info</button>
            </div>
            <TitleCards/>
        </div>
      </div>
      <div className="more-cards">
        <TitleCards title={"Phim Lẻ Mới Nhất"} category={"phim-le"}/>
        <TitleCards title={"Phim Bộ Hot"} category={"phim-bo"}/>
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
