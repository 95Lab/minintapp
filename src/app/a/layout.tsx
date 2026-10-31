import "@/components/runtime-design.css";
export default function AppLayout({children}:{children:React.ReactNode}) {
  return <div className="mini-runtime">{children}</div>;
}
