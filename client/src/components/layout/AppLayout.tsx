import { Outlet } from 'react-router-dom';
import Header from './Header';
import PlayerBar from '../player/PlayerBar';

export default function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-[#121212]">
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-6">
        <Outlet />
      </main>
      <PlayerBar />
    </div>
  );
}
