"use client";

interface RecurringDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onChoice: (choice: "this" | "all") => void;
}

export default function RecurringDialog({
  isOpen,
  onClose,
  onChoice,
}: RecurringDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">
            Edit recurring event
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            How would you like to apply this change?
          </p>
        </div>

        <div className="p-3 space-y-1.5">
          <button
            onClick={() => onChoice("this")}
            className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <p className="text-sm font-medium text-gray-900">
              Edit this occurrence
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Only change this specific date
            </p>
          </button>
          <button
            onClick={() => onChoice("all")}
            className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <p className="text-sm font-medium text-gray-900">
              Edit all future events
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Update the entire recurring series
            </p>
          </button>
        </div>

        <div className="px-5 pb-4">
          <button
            onClick={onClose}
            className="w-full text-center text-xs text-gray-500 hover:text-gray-700 transition-colors py-1"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
