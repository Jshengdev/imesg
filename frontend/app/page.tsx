
import type { NextPage } from 'next';

const Home: NextPage = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen celestial-background text-white">
      <div className="cloud cloud-1"></div>
      <div className="cloud cloud-2"></div>
      <div className="cloud cloud-3"></div>
      <div className="cloud cloud-4"></div>
      <div className="cloud cloud-5"></div>
      <main className="flex flex-col items-center justify-center flex-1 px-20 text-center z-10">
        <h1 className="text-6xl font-bold text-accent">
          iMesg
        </h1>
        <p className="mt-3 text-2xl max-w-2xl">
          Welcome to iMesg, your AI-powered iMessage assistant. Seamlessly integrate AI into your conversations, get summaries, and much more.
        </p>
        <div className="mt-8">
          <a href="imessage:" className="btn-imessage">
            Open iMessage
          </a>
        </div>
      </main>
    </div>
  );
};

export default Home;
