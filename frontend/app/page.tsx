
import type { NextPage } from 'next';

const Home: NextPage = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
      <main className="flex flex-col items-center justify-center flex-1 px-20 text-center">
        <h1 className="text-6xl font-bold text-accent">
          iMesg
        </h1>
        <p className="mt-3 text-2xl">
          Your AI-powered iMessage assistant
        </p>
      </main>
    </div>
  );
};

export default Home;
