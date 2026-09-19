export default function Card({ className = "", children }) {
  return (
    <section className={`surface-card ${className}`.trim()}>{children}</section>
  );
}
