$code = @"
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;

public class IcoMaker {
    public static void MakeCircleIco(string pngPath, string icoPath) {
        using (Bitmap orig = new Bitmap(pngPath)) {
            int size = Math.Min(orig.Width, orig.Height);
            using (Bitmap circleBmp = new Bitmap(size, size, PixelFormat.Format32bppArgb)) {
                using (Graphics g = Graphics.FromImage(circleBmp)) {
                    g.Clear(Color.Transparent);
                    g.SmoothingMode = SmoothingMode.AntiAlias;
                    
                    using (GraphicsPath path = new GraphicsPath()) {
                        path.AddEllipse(0, 0, size, size);
                        g.SetClip(path);
                        g.DrawImage(orig, new Rectangle(0, 0, size, size), new Rectangle(0, 0, size, size), GraphicsUnit.Pixel);
                    }
                }
                
                // Now resize to 256x256 for the ICO
                using (Bitmap icoBmp = new Bitmap(256, 256, PixelFormat.Format32bppArgb)) {
                    using (Graphics g2 = Graphics.FromImage(icoBmp)) {
                        g2.Clear(Color.Transparent);
                        g2.SmoothingMode = SmoothingMode.AntiAlias;
                        g2.InterpolationMode = InterpolationMode.HighQualityBicubic;
                        g2.DrawImage(circleBmp, 0, 0, 256, 256);
                    }
                    
                    // Save as PNG to memory
                    using (MemoryStream ms = new MemoryStream()) {
                        icoBmp.Save(ms, ImageFormat.Png);
                        byte[] pngBytes = ms.ToArray();
                        
                        // Write ICO
                        using (FileStream fs = new FileStream(icoPath, FileMode.Create)) {
                            BinaryWriter bw = new BinaryWriter(fs);
                            // Header
                            bw.Write((ushort)0); // reserved
                            bw.Write((ushort)1); // type 1 = icon
                            bw.Write((ushort)1); // 1 image
                            
                            // Directory
                            bw.Write((byte)0); // width (0 = 256)
                            bw.Write((byte)0); // height (0 = 256)
                            bw.Write((byte)0); // color count
                            bw.Write((byte)0); // reserved
                            bw.Write((ushort)1); // color planes
                            bw.Write((ushort)32); // bpp
                            bw.Write((uint)pngBytes.Length); // size
                            bw.Write((uint)22); // offset
                            
                            // Data
                            bw.Write(pngBytes);
                        }
                    }
                }
            }
        }
    }
}
"@

Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing

$pngPath = "C:\Users\Admin\OneDrive\Documents\Project System\MelannPastDueReportMonitoring\assets\Icon desktop logo.png"
$icoPath = "C:\Users\Admin\OneDrive\Documents\Project System\MelannPastDueReportMonitoring\assets\MelannSystem.ico"
$shortcutPath = "C:\Users\Admin\OneDrive\Desktop\Melann Lending System.lnk"

# 1. Create transparent circle ICO
[IcoMaker]::MakeCircleIco($pngPath, $icoPath)

# 2. Re-apply the icon to the shortcut to force Windows to refresh it
$WshShell = New-Object -ComObject WScript.Shell
$shortcut = $WshShell.CreateShortcut($shortcutPath)
# Give it a slightly different string format to force Windows Explorer icon cache to refresh
$shortcut.IconLocation = "$icoPath, 0"
$shortcut.Save()

# Attempt to refresh explorer to pick up the new icon
(New-Object -ComObject Shell.Application).NameSpace(0).ParseName("C:\Users\Admin\OneDrive\Desktop").InvokeVerb("refresh")

Write-Host "Done making circle icon!"
