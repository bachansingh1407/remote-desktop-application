import { Montserrat, Roboto, Merriweather, Poppins } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat" });
const roboto = Roboto({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-roboto" });
const merriweather = Merriweather({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-merriweather" });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-poppins" });

export const metadata = { title: "Remote Campus Application" };

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${montserrat.variable} ${roboto.variable} ${merriweather.variable} ${poppins.variable}`}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}