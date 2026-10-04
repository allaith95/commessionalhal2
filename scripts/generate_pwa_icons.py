#!/usr/bin/env python3
import zlib
import struct
import math
import os

def create_png(width, height, get_pixel_func):
    """
    Creates a pure PNG RGBA file using standard library (zlib & struct).
    get_pixel_func(x, y, width, height) returns (r, g, b, a) with values 0-255.
    """
    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0)  # Filter type 0 (None)
        for x in range(width):
            r, g, b, a = get_pixel_func(x, y, width, height)
            raw_data.extend([int(r) & 0xFF, int(g) & 0xFF, int(b) & 0xFF, int(a) & 0xFF])
    
    compressed = zlib.compress(bytes(raw_data), 9)
    
    def chunk(tag, data):
        c = bytearray(tag)
        c.extend(data)
        crc = zlib.crc32(c)
        return struct.pack('>I', len(data)) + c + struct.pack('>I', crc)
    
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    
    png = bytearray(b'\x89PNG\r\n\x1a\n')
    png.extend(chunk(b'IHDR', ihdr))
    png.extend(chunk(b'IDAT', compressed))
    png.extend(chunk(b'IEND', b''))
    return bytes(png)

def draw_icon(x, y, w, h, is_maskable=False):
    # Normalized coords (-1 to 1)
    # Maskable safe zone is central 80% (scale 0.70)
    scale_factor = 0.68 if is_maskable else 0.82
    nx = ((x / (w - 1)) * 2 - 1) / scale_factor
    ny = ((y / (h - 1)) * 2 - 1) / scale_factor
    
    # 100% Solid background for Android WebAPK compatibility (no transparency!)
    # Base background gradient (dark navy brand color #1e293b to #0f172a)
    grad = (y / h)
    bg_r = int(35 - grad * 15)
    bg_g = int(49 - grad * 20)
    bg_b = int(66 - grad * 24)
    r, g, b, a = bg_r, bg_g, bg_b, 255

    # Center circle glow behind scales
    dist_center = math.sqrt(nx*nx + ny*ny)
    if dist_center < 0.85:
        glow = (1.0 - dist_center / 0.85) * 0.35
        r = int(r * (1 - glow) + 14 * glow)
        g = int(g * (1 - glow) + 165 * glow)
        b = int(b * (1 - glow) + 233 * glow)

    # Main pillar (vertical center)
    if abs(nx) < 0.05 and -0.45 <= ny <= 0.45:
        # Sky blue pillar
        return (56, 189, 248, 255)
    
    # Base pedestal
    if abs(nx) < 0.35 and 0.42 <= ny <= 0.52:
        return (2, 132, 199, 255)
    if abs(nx) < 0.20 and 0.36 <= ny <= 0.42:
        return (56, 189, 248, 255)

    # Crown jewel at top
    d_crown = math.sqrt(nx*nx + (ny + 0.48)**2)
    if d_crown < 0.09:
        return (252, 211, 77, 255)  # Gold
    if d_crown < 0.045:
        return (255, 255, 255, 255)

    # Balance beam (arched)
    beam_y = -0.32 + 0.12 * (nx * nx)
    if abs(nx) < 0.52 and abs(ny - beam_y) < 0.042:
        return (252, 211, 77, 255)  # Gold beam

    # Left dish suspension strings & dish
    left_x, left_y = -0.48, -0.29
    if abs(nx - left_x) < 0.025 and left_y <= ny <= 0.05:
        return (148, 163, 184, 255)  # Cord
    # Left dish bowl
    d_left_dish = math.sqrt(((nx - left_x)*1.5)**2 + ((ny - 0.05)*2.5)**2)
    if d_left_dish < 0.20 and ny >= 0.03:
        return (56, 189, 248, 255)  # Sky blue bowl
    # Left dish coins
    d_coin1 = math.sqrt((nx - (left_x - 0.03))**2 + (ny - 0.0)**2)
    d_coin2 = math.sqrt((nx - (left_x + 0.04))**2 + (ny - 0.02)**2)
    if d_coin1 < 0.05 or d_coin2 < 0.045:
        return (245, 158, 11, 255)

    # Right dish suspension strings & dish
    right_x, right_y = 0.48, -0.29
    if abs(nx - right_x) < 0.025 and right_y <= ny <= 0.05:
        return (148, 163, 184, 255)
    # Right dish bowl
    d_right_dish = math.sqrt(((nx - right_x)*1.5)**2 + ((ny - 0.05)*2.5)**2)
    if d_right_dish < 0.20 and ny >= 0.03:
        return (16, 185, 129, 255)  # Emerald green bowl
    # Right dish coins
    d_coin3 = math.sqrt((nx - (right_x - 0.03))**2 + (ny - 0.0)**2)
    d_coin4 = math.sqrt((nx - (right_x + 0.04))**2 + (ny - 0.02)**2)
    if d_coin3 < 0.05 or d_coin4 < 0.045:
        return (245, 158, 11, 255)

    # Commission badge frame in bottom middle
    if abs(nx) < 0.32 and 0.16 <= ny <= 0.30:
        if abs(nx) > 0.30 or ny < 0.18 or ny > 0.28:
            return (252, 211, 77, 255)  # Gold border
        else:
            return (30, 41, 59, 255)  # Dark slate inner

    return (r, g, b, 255)

os.makedirs('public', exist_ok=True)

print("Generating pwa-192x192.png...")
with open('public/pwa-192x192.png', 'wb') as f:
    f.write(create_png(192, 192, lambda x, y, w, h: draw_icon(x, y, w, h, False)))

print("Generating pwa-512x512.png...")
with open('public/pwa-512x512.png', 'wb') as f:
    f.write(create_png(512, 512, lambda x, y, w, h: draw_icon(x, y, w, h, False)))

print("Generating pwa-maskable-192x192.png...")
with open('public/pwa-maskable-192x192.png', 'wb') as f:
    f.write(create_png(192, 192, lambda x, y, w, h: draw_icon(x, y, w, h, True)))

print("Generating pwa-maskable-512x512.png...")
with open('public/pwa-maskable-512x512.png', 'wb') as f:
    f.write(create_png(512, 512, lambda x, y, w, h: draw_icon(x, y, w, h, True)))

print("Generating apple-touch-icon.png (180x180)...")
with open('public/apple-touch-icon.png', 'wb') as f:
    f.write(create_png(180, 180, lambda x, y, w, h: draw_icon(x, y, w, h, False)))

print("Generating favicon.ico...")
with open('public/favicon.ico', 'wb') as f:
    png_data = create_png(64, 64, lambda x, y, w, h: draw_icon(x, y, w, h, False))
    ico_header = struct.pack('<HHH', 0, 1, 1)
    ico_entry = struct.pack('<BBBBHHII', 64, 64, 0, 0, 1, 32, len(png_data), 22)
    f.write(ico_header + ico_entry + png_data)

print("All Android PWA compliant icons generated successfully!")
