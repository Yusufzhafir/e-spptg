import { HydrateClient, trpc } from "@/trpc/server";

const PageTesting = async () => {
    const { greeting } = await trpc.hello({ text: "ad" })
    console.log("here is data", greeting)
    return (
        <HydrateClient>
            <div>
                Enter
            </div>
        </HydrateClient>
    );
}

export default PageTesting;