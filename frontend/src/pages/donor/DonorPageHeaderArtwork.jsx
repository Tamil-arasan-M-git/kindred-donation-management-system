import profileBannerArt from "../../assets/donor-profile-banner-transparent.png";
import "./DonorPageHeaderArtwork.css";

export default function DonorPageHeaderArtwork() {
  return (
    <div className="donor-page-header-artwork" aria-hidden="true">
      <img src={profileBannerArt} alt="" />
    </div>
  );
}
