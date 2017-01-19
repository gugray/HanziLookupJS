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
                conv.WriteResults("../library/src/x-mmah-medians.js",
                    "../library/src/x-mmah-strokes.js",
                    "../library/src/x-mmah-compact.js");
            }
            else if (args[0] == "hl-compact")
            {
            }
        }
    }
}
