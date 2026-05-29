export default function CreateAssignmentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex flex-col overflow-hidden -mx-4 -my-6 lg:-mx-6">
      {children}
    </div>
  );
}
