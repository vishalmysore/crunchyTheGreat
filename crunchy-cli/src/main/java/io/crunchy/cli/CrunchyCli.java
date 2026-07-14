package io.crunchy.cli;

import io.crunchy.connector.jira.JiraIssueParser;
import io.crunchy.core.export.JsonExporter;
import io.crunchy.core.export.MarkdownExporter;
import io.crunchy.core.model.CompressedContext;
import io.crunchy.core.model.CompressionLevel;
import io.crunchy.core.model.NormalizedDocument;
import io.crunchy.core.pipeline.CompressionPipeline;
import picocli.CommandLine;
import picocli.CommandLine.Command;
import picocli.CommandLine.Option;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.concurrent.Callable;

@Command(
        name = "crunchy",
        mixinStandardHelpOptions = true,
        version = "crunchy 0.1.0",
        description = "Compresses Jira issue context into a compact CIR document for AI coding agents."
)
public final class CrunchyCli implements Callable<Integer> {

    @Option(names = {"-i", "--input"}, required = true,
            description = "Input file: a Jira REST issue JSON export, or plain text with --source text")
    Path input;

    @Option(names = {"-s", "--source"}, defaultValue = "jira",
            description = "Input source: jira | text (default: ${DEFAULT-VALUE})")
    String source;

    @Option(names = {"-l", "--level"}, defaultValue = "full",
            description = "Compression level: tiny | small | medium | full (default: ${DEFAULT-VALUE})")
    String level;

    @Option(names = {"-f", "--format"}, defaultValue = "json",
            description = "Output format: json | markdown (default: ${DEFAULT-VALUE})")
    String format;

    @Option(names = {"-o", "--output"},
            description = "Output file (default: stdout)")
    Path output;

    @Override
    public Integer call() throws IOException {
        NormalizedDocument document = readDocument();
        CompressionLevel compressionLevel =
                CompressionLevel.valueOf(level.toUpperCase(Locale.ROOT));

        long start = System.nanoTime();
        CompressedContext result = CompressionPipeline.standard().process(document, compressionLevel);
        long elapsedMs = (System.nanoTime() - start) / 1_000_000;

        String rendered = switch (format.toLowerCase(Locale.ROOT)) {
            case "markdown", "md" -> new MarkdownExporter().export(result);
            case "json" -> new JsonExporter().export(result);
            default -> throw new CommandLine.ParameterException(
                    new CommandLine(this), "Unknown format: " + format);
        };

        if (output != null) {
            Files.writeString(output, rendered);
            System.err.printf("Wrote %s (%d chars, %.0f%% reduction, %d ms)%n",
                    output, rendered.length(), result.getCompressionRatio() * 100, elapsedMs);
        } else {
            System.out.println(rendered);
        }
        return 0;
    }

    private NormalizedDocument readDocument() throws IOException {
        if ("text".equalsIgnoreCase(source)) {
            NormalizedDocument doc = new NormalizedDocument();
            doc.setSource("text");
            doc.setTitle(input.getFileName().toString());
            doc.setDescription(Files.readString(input));
            return doc;
        }
        try (InputStream in = Files.newInputStream(input)) {
            return new JiraIssueParser().parse(in);
        }
    }

    public static void main(String[] args) {
        System.exit(new CommandLine(new CrunchyCli()).execute(args));
    }
}
