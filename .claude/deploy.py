"""Deploy helper for ESSEN Credentialing Platform — production server operations via paramiko."""
import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

SERVER = '69.62.70.191'
USER = 'hdpulse2000'
PASSWORD = 'HDPulseVPS((()))'

APP = {
    'name': 'E_Credentialing',
    'server_path': '/var/www/E_Credentialing',
    'branch': 'master',
    'compose_file': 'docker-compose.prod.yml',
    'containers': ['ecred-web-prod', 'ecred-worker-prod'],
}


def ssh_run(commands, timeout=300):
    """Run one or more commands on the production server, print output."""
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(SERVER, username=USER, password=PASSWORD, timeout=15)
    if isinstance(commands, str):
        commands = [commands]
    for cmd in commands:
        print(f'>>> {cmd}')
        stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
        out = stdout.read().decode().strip()
        err = stderr.read().decode().strip()
        exit_code = stdout.channel.recv_exit_status()
        if out:
            print(out)
        if err:
            print(f'STDERR: {err}', file=sys.stderr)
        if exit_code != 0:
            print(f'EXIT CODE: {exit_code}')
        print()
    client.close()


def deploy():
    """Deploy: git pull -> docker compose down -> up --build -> prune -> ps."""
    path = APP['server_path']
    branch = APP['branch']
    compose = APP['compose_file']

    print(f'=== Deploying {APP["name"]} ===')
    print(f'  Server path: {path}')
    print(f'  Branch: {branch}')
    print()

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(SERVER, username=USER, password=PASSWORD, timeout=15)

    steps = [
        (f'cd {path} && git pull origin {branch}', 60, True),
        (f'cd {path} && docker compose -f {compose} down', 120, True),
        (f'cd {path} && docker compose -f {compose} up -d --build', 600, True),
        ('docker image prune -f', 120, False),
        (f'cd {path} && docker compose -f {compose} ps', 30, False),
    ]
    step_names = ['Pull', 'Down', 'Build', 'Prune', 'Status']

    for i, (cmd, cmd_timeout, fatal) in enumerate(steps, 1):
        print(f'[{i}/5] {step_names[i-1]}')
        print(f'>>> {cmd}')
        try:
            stdin, stdout, stderr = client.exec_command(cmd, timeout=cmd_timeout)
            out = stdout.read().decode().strip()
            err = stderr.read().decode().strip()
            exit_code = stdout.channel.recv_exit_status()
            if out:
                print(out)
            if err:
                print(f'STDERR: {err}', file=sys.stderr)
            if exit_code != 0:
                print(f'EXIT CODE: {exit_code}')
                if fatal:
                    print(f'\nDeploy FAILED at step {i} ({step_names[i-1]})')
                    client.close()
                    return False
        except Exception as e:
            print(f'Warning: {step_names[i-1]} step error: {e}')
            if fatal:
                client.close()
                return False
        print()

    client.close()
    print(f'=== {APP["name"]} deployed successfully ===')
    return True


def create_db():
    """Create the e_credentialing_db database on the shared PostgreSQL container."""
    print('=== Creating database ===')
    ssh_run([
        "docker exec supabase_db_hdpulse2000 psql -U postgres -c 'CREATE DATABASE e_credentialing_db;'",
    ])


def migrate():
    """Run Prisma migrations inside the running web container."""
    path = APP['server_path']
    print('=== Running Prisma migrations ===')
    ssh_run([
        f'docker exec ecred-web-prod npx prisma migrate deploy',
    ])


if __name__ == '__main__':
    if len(sys.argv) < 2:
        deploy()
    elif sys.argv[1] == 'deploy':
        deploy()
    elif sys.argv[1] == 'create-db':
        create_db()
    elif sys.argv[1] == 'migrate':
        migrate()
    else:
        ssh_run(' && '.join(sys.argv[1:]))
