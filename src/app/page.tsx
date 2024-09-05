import Image from "next/image";

export default function Home() {
  return (
    <>
      <header>
        <h1>Welcome to Sharkcicle Smp!</h1>
        <nav>
            <ul>
                <Image src="/sharkcicle-logo.png" alt="logo" width={60} height={60}/>
                <li><a href="https://discord.com/invite/UNBQwEdaaP" target="_blank">Discord</a></li>
                <li><a href="https://map.sharkcicle.com" target="_blank">Map</a></li>
                <li><a href="gallery.html">Images</a></li>
                <Image src="/sharkcicle-logo.png" alt="logo" width={60} height={60}/>
            </ul>
        </nav>
    </header>
    </>
  );
}
