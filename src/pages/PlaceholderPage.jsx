export function PlaceholderPage({ title, description }) {
  return (
    <section className="placeholder-panel">
      <p className="eyebrow">Planned Module</p>
      <h3>{title}</h3>
      <p>{description}</p>
    </section>
  );
}
