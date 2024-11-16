import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface RenameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName: string;
  onRename: (newName: string) => void;
}

export function RenameDialog({ open, onOpenChange, initialName, onRename }: RenameDialogProps) {
  const [name, setName] = useState(initialName);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename File</DialogTitle>
        </DialogHeader>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter file name"
          className="mt-4 bg-background text-foreground"
          autoFocus
        />
        <DialogFooter className="mt-4">
          <Button 
            variant="secondary"
            onClick={() => onOpenChange(false)}
            className="bg-muted hover:bg-muted/80"
          >
            Cancel
          </Button>
          <Button onClick={() => {
            onRename(name);
            onOpenChange(false);
          }}>
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
