import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Send, 
  Video, 
  MoreVertical, 
  Flag, 
  UserX, 
  LogOut,
  VideoOff 
} from 'lucide-react';
import { ChatMessage, MatchSession } from '@/types';
import { toast } from 'sonner';

interface ChatInterfaceProps {
  session: MatchSession;
  currentUserId: string;
  onSendMessage: (content: string) => void;
  onRequestVideo: () => void;
  onAcceptVideo: () => void;
  onDeclineVideo: () => void;
  onReport: (reason: string) => void;
  onBlock: () => void;
  onEndSession: () => void;
  isVideoCallActive: boolean;
}

export function ChatInterface({
  session,
  currentUserId,
  onSendMessage,
  onRequestVideo,
  onAcceptVideo,
  onDeclineVideo,
  onReport,
  onBlock,
  onEndSession,
  isVideoCallActive
}: ChatInterfaceProps) {
  const [messageInput, setMessageInput] = useState('');
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [showVideoConsentDialog, setShowVideoConsentDialog] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [session.messages]);

  useEffect(() => {
    if (session.videoRequested && session.videoRequested.requesterId !== currentUserId) {
      setShowVideoConsentDialog(true);
    }
  }, [session.videoRequested, currentUserId]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const content = messageInput.trim();
    if (content) {
      onSendMessage(content);
      setMessageInput('');
    }
  };

  const handleVideoRequest = () => {
    if (session.videoRequested) {
      toast.info('Video call request already pending...');
      return;
    }
    onRequestVideo();
    toast.info('Waiting for other person to accept...');
  };

  const handleReport = (reason: string) => {
    onReport(reason);
    setShowReportDialog(false);
    toast.success('Report submitted. Thank you for helping keep our community safe.');
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const otherUser = session.users.find(user => user.id !== currentUserId);
  const isVideoRequested = session.videoRequested?.status === 'pending';
  const isVideoRequestedByMe = session.videoRequested?.requesterId === currentUserId;

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <Card className="rounded-none border-x-0 border-t-0">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Matched</h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Shared tags:</span>
                {session.sharedTags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowReportDialog(true)}>
                  <Flag className="h-4 w-4 mr-2" />
                  Report
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowBlockDialog(true)}>
                  <UserX className="h-4 w-4 mr-2" />
                  Block
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowEndDialog(true)}>
                  <LogOut className="h-4 w-4 mr-2" />
                  End Session
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <div className="text-xs text-muted-foreground">
            {isVideoCallActive ? (
              "Video call active"
            ) : (
              "Text chat only. Request video to switch to face-to-face."
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {session.messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.userId === currentUserId ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[70%] rounded-lg p-3 ${
                  message.type === 'system'
                    ? 'bg-muted text-center text-sm text-muted-foreground mx-auto'
                    : message.userId === currentUserId
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <p>{message.content}</p>
                {message.type === 'message' && (
                  <p className="text-xs opacity-70 mt-1">
                    {formatTime(message.timestamp)}
                  </p>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Video Request Button */}
      {!isVideoCallActive && (
        <div className="p-4 border-t">
          <Button
            onClick={handleVideoRequest}
            disabled={isVideoRequested}
            variant={isVideoRequested ? "secondary" : "default"}
            className="w-full"
          >
            {isVideoCallActive ? (
              <>
                <VideoOff className="h-4 w-4 mr-2" />
                End Video Call
              </>
            ) : isVideoRequested ? (
              isVideoRequestedByMe ? (
                'Waiting for response...'
              ) : (
                'Video call requested'
              )
            ) : (
              <>
                <Video className="h-4 w-4 mr-2" />
                Request Video
              </>
            )}
          </Button>
        </div>
      )}

      {/* Message Input */}
      <Card className="rounded-none border-x-0 border-b-0">
        <CardContent className="p-4">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Input
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1"
              maxLength={500}
            />
            <Button type="submit" disabled={!messageInput.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Video Consent Dialog */}
      <AlertDialog open={showVideoConsentDialog} onOpenChange={setShowVideoConsentDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Video Call Request</AlertDialogTitle>
            <AlertDialogDescription>
              This person wants to start a video call. Your camera & microphone will be used. 
              You can decline and remain in text chat.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onDeclineVideo}>
              Decline
            </AlertDialogCancel>
            <AlertDialogAction onClick={onAcceptVideo}>
              Accept
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Report Dialog */}
      <AlertDialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Report User</AlertDialogTitle>
            <AlertDialogDescription>
              Why are you reporting this user? This will help us improve our community.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2">
            <AlertDialogAction onClick={() => handleReport('inappropriate_content')}>
              Inappropriate Content
            </AlertDialogAction>
            <AlertDialogAction onClick={() => handleReport('harassment')}>
              Harassment
            </AlertDialogAction>
            <AlertDialogAction onClick={() => handleReport('spam')}>
              Spam
            </AlertDialogAction>
            <AlertDialogAction onClick={() => handleReport('other')}>
              Other
            </AlertDialogAction>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Block Dialog */}
      <AlertDialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to block this user? They won't be able to match with you again for 30 days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onBlock}>
              Block User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* End Session Dialog */}
      <AlertDialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End Session</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to end this study session? This will close the chat and return you to the main page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onEndSession}>
              End Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}