namespace MmahConvert
{
    public class Program
    {
        public static void Main(string[] args)
        {
            Converter conv = new Converter();
            conv.Parse("../work/graphics.txt");
            conv.WriteResults("../src/js/x-mmah-medians.js", "../src/js/x-mmah-strokes.js");
        }
    }
}
