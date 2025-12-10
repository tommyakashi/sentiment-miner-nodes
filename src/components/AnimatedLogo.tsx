import tbgLogo from "@/assets/tbg-logo.webp";

const AnimatedLogo = () => {
  return (
    <div className="flex items-center justify-center">
      <img
        src={tbgLogo}
        alt="TBG Logo"
        className="h-32 md:h-48 w-auto animate-logo-glow"
      />
    </div>
  );
};

export default AnimatedLogo;
