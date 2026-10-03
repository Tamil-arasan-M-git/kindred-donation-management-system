import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function DonationActions({ donation }) {
  const { t } = useTranslation();
  if (!donation) return null;

  if (donation.status === "matched") {
    return (
      <Link
        className="secondary-button"
        to={`/donor/donations/${donation.id}#packaging`}
      >
        {t("donor.donations.viewPackaging")}
      </Link>
    );
  }
  if (donation.status === "packaging_notified") {
    return (
      <Link
        className="secondary-button"
        to={`/donor/donations/${donation.id}#pickup`}
      >
        {t("donor.donations.schedulePickup")}
      </Link>
    );
  }
  if (
    ["pickup_scheduled", "collected", "delivered"].includes(donation.status)
  ) {
    return (
      <Link className="secondary-button" to="/donor/pickup">
        {t("donor.donations.viewPickup")}
      </Link>
    );
  }
  return null;
}
