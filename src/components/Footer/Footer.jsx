import React from 'react'
import './Footer.css'
import ytb_icon from '../../assets/youtube_icon.png'
import twt_icon from '../../assets/twitter_icon.png'
import ins_icon from '../../assets/instagram_icon.png'
import fb_icon from '../../assets/facebook_icon.png'

const Footer = () => {
  return (
    <div className='footer'>
      <div className="footer-icons">
        <img src= {ytb_icon} alt="" />
        <img src={twt_icon} alt="" />
        <img src={ins_icon} alt="" />
        <img src={fb_icon} alt="" />
      </div>
      <ul>
        <li>Audio Description</li>
        <li>Help Centre</li>
        <li>Gift Cards</li>
        <li>Media Centre</li>
        <li>Investor Relations</li>
        <li>Jobs</li>
        <li>Terms of Use</li>
        <li>Privacy</li>
        <li>Legal Notices</li>
        <li>Cookies References</li>
        <li>Corporate Info</li>
        <li>Contact Us</li>
      </ul>
      <p className='copyright-text'>© 2004-2025 Petflix, Inc.</p>
    </div>
  )
}

export default Footer
