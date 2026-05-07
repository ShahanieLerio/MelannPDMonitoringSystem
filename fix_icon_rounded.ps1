$code = @"
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;

public class IcoMaker {
    public static void MakeRoundedSquareIco(string pngPath, string icoPath) {
        using (Bitmap orig = new Bitmap(pngPath)) {
            int size = Math.Min(orig.Width, orig.Height);
            using (Bitmap roundedBmp = new Bitmap(size, size, PixelFormat.Format32bppArgb)) {
                using (Graphics g = Graphics.FromImage(roundedBmp)) {
                    g.Clear(Color.Transparent);
                    g.SmoothingMode = SmoothingMode.AntiAlias;
                    
                    using (GraphicsPath path = new GraphicsPath()) {
                        // 15% radius for the rounded corners to perfectly clip out the white background
                        int radius = (int)(size * 0.18); 
                        int d = radius * 2;
                        path.AddArc(0, 0, d, d, 180, 90);
                        path.AddArc(size - d, 0, d, d, 270, 90);
                        path.AddArc(size - d, size - d, d, d, 0, 90);
                        path.AddArc(0, size - d, d, d, 90, 90);
                        path.CloseFigure();
                        
                        g.SetClip(path);
                        g.DrawImage(orig, new Rectangle(0, 0, size, size), new Rectangle(0, 0, size, size), GraphicsUnit.Pixel);
                    }
                }
                
                using (Bitmap icoBmp = new Bitmap(256, 256, PixelFormat.Format32bppArgb)) {
                    using (Graphics g2 = Graphics.FromImage(icoBmp)) {
                        g2.Clear(Color.Transparent);
                        g2.SmoothingMode = SmoothingMode.AntiAlias;
                        g2.InterpolationMode = InterpolationMode.HighQualityBicubic;
                        g2.DrawImage(roundedBmp, 0, 0, 256, 256);
                    }
                    
                    using (MemoryStream ms = new MemoryStream()) {
                        icoBmp.Save(ms, ImageFormat.Png);
                        byte[] pngBytes = ms.ToArray();
                        
                        using (FileStream fs = new FileStream(icoPath, FileMode.Create)) {
                            BinaryWriter bw = new BinaryWriter(fs);
                            bw.Write((ushort)0);
                            bw.Write((ushort)1);
                            bw.Write((ushort)1);
                            
                            bw.Write((byte)0);
                            bw.Write((byte)0);
                            bw.Write((byte)0);
                            bw.Write((byte)0);
                            bw.Write((ushort)1);
                            bw.Write((ushort)32);
                            bw.Write((uint)pngBytes.Length);
                            bw.Write((uint)22);
                            
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

$pngPath = "C:\Users\Admin\OneDrive\Desktop\MELANN FILES\Logo\NewLogo.jpg"
$icoPath = "C:\Users\Admin\OneDrive\Documents\Project System\MelannPastDueReportMonitoring\assets\MelannSystem.ico"
$shortcutPath = "C:\Users\Admin\OneDrive\Desktop\Melann Lending System.lnk"

[IcoMaker]::MakeRoundedSquareIco($pngPath, $icoPath)

$WshShell = New-Object -ComObject WScript.Shell
$shortcut = $WshShell.CreateShortcut($shortcutPath)
# Change the path slightly or just touch it to force a refresh of the icon cache
$shortcut.IconLocation = "$icoPath, 0"
$shortcut.Save()

# Attempt to refresh explorer to pick up the new icon
(New-Object -ComObject Shell.Application).NameSpace(0).ParseName("C:\Users\Admin\OneDrive\Desktop").InvokeVerb("refresh")

Write-Host "Done making rounded square icon!"
