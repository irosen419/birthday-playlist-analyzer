import { useState } from 'react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd';
import type { PlaylistTrack } from '../../types';
import TrackItem from './TrackItem';

interface PlaylistTrackListProps {
  tracks: PlaylistTrack[];
  onReorder: (startIndex: number, endIndex: number) => void;
  onPlay: (uri: string) => void;
  onToggleLock: (trackId: string) => void;
  onRemove: (trackId: string) => void;
  onMove: (trackId: string, newPosition: number) => void;
  isGenerating?: boolean;
}

export default function PlaylistTrackList({
  tracks,
  onReorder,
  onPlay,
  onToggleLock,
  onRemove,
  onMove,
  isGenerating = false,
}: PlaylistTrackListProps) {
  const [openPopoverTrackId, setOpenPopoverTrackId] = useState<string | null>(
    null
  );

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    if (result.source.index === result.destination.index) return;
    onReorder(result.source.index, result.destination.index);
  }

  if (!tracks.length) {
    if (isGenerating) {
      return (
        <div className="rounded-xl bg-[#181818] p-12 text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#282828] border-t-[#1DB954]" />
          <p className="text-lg font-semibold text-white">
            Generating your playlist...
          </p>
          <p className="mt-2 text-sm text-[#b3b3b3]">
            Analyzing your music and finding the perfect tracks. This may take a moment.
          </p>
        </div>
      );
    }

    return (
      <div className="rounded-xl bg-[#181818] p-8 text-center">
        <p className="text-[#b3b3b3]">
          No tracks yet. Generate a playlist or search to add tracks.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="sticky top-[60px] z-10 mb-1 flex items-center gap-3 border-b border-[#282828] bg-[#181818]/95 px-3 py-2 text-xs uppercase tracking-widest text-[#b3b3b3] backdrop-blur md:hidden">
        <span className="w-6 text-center">#</span>
        <span className="min-w-0 flex-1 pl-[52px]">Title</span>
        <span aria-hidden className="invisible p-1.5 text-lg leading-none">&#8942;</span>
      </div>
      <div className="sticky top-[60px] z-10 mb-1 hidden items-center gap-3 border-b border-[#282828] bg-[#181818]/95 px-3 py-2 text-xs uppercase tracking-widest text-[#b3b3b3] backdrop-blur md:flex">
        <span aria-hidden className="invisible">&#8645;</span>
        <span className="w-6 text-center">#</span>
        <span className="min-w-0 flex-1 pl-[52px]">Title</span>
        <span>Duration</span>
        <span className="w-[64px] text-right">Actions</span>
      </div>
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="playlist-tracks">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps}>
              {tracks.map((track, index) => (
                <Draggable key={track.id} draggableId={track.id} index={index}>
                  {(draggableProvided) => (
                    <TrackItem
                      track={track}
                      index={index}
                      totalTracks={tracks.length}
                      provided={draggableProvided}
                      isPopoverOpen={openPopoverTrackId === track.id}
                      onOpenPopover={setOpenPopoverTrackId}
                      onPlay={onPlay}
                      onToggleLock={onToggleLock}
                      onRemove={onRemove}
                      onMove={onMove}
                    />
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </>
  );
}
