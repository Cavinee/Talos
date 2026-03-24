import { partnerLogos } from "@/data/mock";

export default function LogoMarquee() {
  const doubled = [...partnerLogos, ...partnerLogos];

  return (
    <section className="py-12 overflow-hidden">
      <div
        className="flex w-max"
        style={{ animation: "marquee 25s linear infinite" }}
      >
        {doubled.map((logo, index) => (
          <span
            key={`${logo}-${index}`}
            className="border border-border rounded-full px-6 py-2 text-text-secondary font-mono text-sm whitespace-nowrap mx-3 flex shrink-0"
          >
            {logo}
          </span>
        ))}
      </div>
    </section>
  );
}
