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
}

export default function PlaylistTrackList({
  tracks,
  onReorder,
  onPlay,
  onToggleLock,
  onRemove,
}: PlaylistTrackListProps) {
  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    if (result.source.index === result.destination.index) return;
    onReorder(result.source.index, result.destination.index);
  }

  if (!tracks.length) {
    return (
      <div className="rounded-xl bg-[#181818] p-8 text-center">
        <p className="text-[#b3b3b3]">
          No tracks yet. Generate a playlist or search to add tracks.
        </p>
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="playlist-tracks">
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps}>
            {tracks.map((track, index) => (
              <Draggable key={track.id} draggableId={track.id} index={index}>
                {(draggableProvided) => (
                  <TrackItem
                    track={track}
                    provided={draggableProvided}
                    onPlay={onPlay}
                    onToggleLock={onToggleLock}
                    onRemove={onRemove}
                  />
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
