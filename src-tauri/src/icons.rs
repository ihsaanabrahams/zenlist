use tauri::image::Image;

pub fn tray_icon() -> Image<'static> {
  let icon_bytes = include_bytes!("../icons/app-icon.png");
  if let Ok(icon) = Image::from_bytes(icon_bytes) {
    return icon;
  }

  let size: u32 = 32;
  let mut rgba = vec![0_u8; (size * size * 4) as usize];
  for pixel in rgba.chunks_exact_mut(4) {
    pixel[0] = 34;
    pixel[1] = 197;
    pixel[2] = 94;
    pixel[3] = 255;
  }

  Image::new_owned(rgba, size, size)
}
