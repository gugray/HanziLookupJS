namespace MmahConvert
{
    public class Program
    {
        public static void Main(string[] args)
        {
            if (args.Length != 1) return;
            else if (args[0] == "mmah-convert")
            {
                Converter conv = new Converter();
                conv.Parse("../work/graphics.txt");
                conv.WriteResults("../library/data/x-mmah-medians.js",
                    "../library/data/x-mmah-strokes.js",
                    "../library/data/mmah.json");
            }
            else if (args[0] == "hl-compact")
            {
                Compacter comp = new Compacter();
                comp.Parse("../library/data/x-hl-strokes.json");
                comp.WriteResults("../library/data/orig.json");
            }
        }
    }
}
