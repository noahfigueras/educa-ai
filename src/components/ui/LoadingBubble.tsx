
export const LoadingBubble = () => {
  return (
    <div className="flex space-x-1 items-center p-2 rounded-xl bg-gray-200 w-fit">
      <span className="h-2 w-2 bg-gray-600 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
      <span className="h-2 w-2 bg-gray-600 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
      <span className="h-2 w-2 bg-gray-600 rounded-full animate-bounce"></span>
    </div>
  );
};
