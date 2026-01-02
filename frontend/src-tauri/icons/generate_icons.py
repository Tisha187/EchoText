#!/usr/bin/env python3
"""Generate placeholder icon files for Tauri app"""

from PIL import Image, ImageDraw
import os

def create_png_icon(size, filename):
    """Create a simple PNG icon"""
    img = Image.new('RGBA', (size, size), (139, 69, 19, 255))  # Brown background
    draw = ImageDraw.Draw(img)
    
    # Draw a simple microphone icon
    center = size // 2
    # Microphone body (rectangle)
    draw.rectangle([center - size//4, center - size//3, center + size//4, center + size//3], 
                   fill=(255, 255, 255, 255))
    # Microphone stand
    draw.rectangle([center - size//12, center + size//3, center + size//12, center + size//2], 
                   fill=(255, 255, 255, 255))
    # Base
    draw.ellipse([center - size//3, center + size//2, center + size//3, center + size//2 + size//6], 
                 fill=(255, 255, 255, 255))
    
    img.save(filename, 'PNG')
    print(f"Created {filename}")

def create_ico_file():
    """Create a simple ICO file"""
    # Create a 256x256 image
    img = Image.new('RGBA', (256, 256), (139, 69, 19, 255))
    draw = ImageDraw.Draw(img)
    
    center = 128
    # Microphone icon
    draw.rectangle([center - 64, center - 85, center + 64, center + 85], 
                   fill=(255, 255, 255, 255))
    draw.rectangle([center - 21, center + 85, center + 21, center + 128], 
                   fill=(255, 255, 255, 255))
    draw.ellipse([center - 85, center + 128, center + 85, center + 170], 
                 fill=(255, 255, 255, 255))
    
    # Save as ICO
    img.save('icon.ico', format='ICO', sizes=[(256, 256), (128, 128), (64, 64), (32, 32), (16, 16)])
    print("Created icon.ico")

def create_icns_file():
    """Create a simple ICNS file placeholder (macOS)"""
    # For now, just create a placeholder - ICNS is complex
    # Tauri will handle conversion if needed
    img = Image.new('RGBA', (512, 512), (139, 69, 19, 255))
    draw = ImageDraw.Draw(img)
    
    center = 256
    draw.rectangle([center - 128, center - 170, center + 128, center + 170], 
                   fill=(255, 255, 255, 255))
    draw.rectangle([center - 43, center + 170, center + 43, center + 256], 
                   fill=(255, 255, 255, 255))
    draw.ellipse([center - 170, center + 256, center + 170, center + 340], 
                 fill=(255, 255, 255, 255))
    
    # Save as PNG (ICNS conversion would need additional tools)
    img.save('icon.icns.png', 'PNG')
    print("Created icon.icns placeholder (PNG format)")

if __name__ == '__main__':
    try:
        # Create PNG icons
        create_png_icon(32, '32x32.png')
        create_png_icon(128, '128x128.png')
        create_png_icon(256, '128x128@2x.png')
        
        # Create ICO file
        create_ico_file()
        
        # Create ICNS placeholder
        create_icns_file()
        
        print("\nAll icon files created successfully!")
    except ImportError:
        print("PIL (Pillow) is required. Install it with: pip install Pillow")
    except Exception as e:
        print(f"Error creating icons: {e}")

