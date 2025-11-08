export const metadata = { title: "OLIG3D Chat" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="pl">
            <body style={{ maxWidth: 720, margin: "2rem auto", fontFamily: "system-ui" }}>
                {children}
            </body>
        </html>
    );
}
